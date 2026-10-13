import React, { useEffect, useRef, useState } from 'react';
import { useTranslation } from 'react-i18next';
import type { WorkspaceItem, WorkspaceItemUpdate, WindowInfo, WindowConfig } from '@common/types';
import {
  mergeWindowInfoIntoLayoutEntry,
  buildLayoutItemFromRegisterItem,
} from '@common/utils/layoutUtils';

import { useCustomIcon } from '../hooks/useCustomIcon';
import { useModalKeyboard } from '../hooks/useModalKeyboard';
import { useWorkspaceItemEditForm } from '../hooks/workspace/useWorkspaceItemEditForm';
import { logError } from '../utils/debug';
import {
  fetchMatchingWindow,
  toWindowConfig,
  toWindowOperationConfig,
} from '../utils/windowFilter';

import GroupItemSelectorModal from './GroupItemSelectorModal';
import FilePickerDialog from './FilePickerDialog';
import WindowSelectorModal from './WindowSelectorModal';
import WindowConfigEditor from './WindowConfigEditor';
import CustomIconEditor from './CustomIconEditor';
import LayoutEntryEditor from './LayoutEntryEditor';
import LayoutCaptureModal from './LayoutCaptureModal';
import UrlConverterMenu from './UrlConverterMenu';
import { Button } from './ui';
import '../styles/components/UrlConverterMenu.css';

interface WorkspaceItemEditModalProps {
  isOpen: boolean;
  onClose: () => void;
  editingItem: WorkspaceItem | null;
  onSave: (id: string, updates: WorkspaceItemUpdate) => Promise<void>;
  /**
   * 独立した編集ウィンドウの中身として描画する（オーバーレイなし・ウィンドウいっぱい）。
   * 現在の編集はこの形でしか使わない。ワークスペースウィンドウ内にモーダルとして重ねると
   * ウィンドウを広げて動かす必要があったため、その経路はやめた
   */
  asPage?: boolean;
}

/**
 * ワークスペースアイテム編集フォーム
 *
 * ワークスペースアイテムの全フィールド（path, args, customIcon, windowConfig等）を編集する。
 * 独立した編集ウィンドウ（WorkspaceItemEditPage）に描画される
 */
const WorkspaceItemEditModal: React.FC<WorkspaceItemEditModalProps> = ({
  isOpen,
  onClose,
  editingItem,
  onSave,
  asPage = false,
}) => {
  const { t } = useTranslation();
  const modalRef = useRef<HTMLDivElement>(null);
  const [windowSelectorOpen, setWindowSelectorOpen] = useState(false);
  const [layoutCaptureOpen, setLayoutCaptureOpen] = useState(false);
  const [layoutEntryWindowSelectorIndex, setLayoutEntryWindowSelectorIndex] = useState<
    number | null
  >(null);

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

  // 上に重ねたグループのアイテム選択の Escape は useModalKeyboard がそちらに任せる
  useModalKeyboard({ isOpen, modalRef, onClose: handleCancel });

  useEffect(() => {
    if (!isOpen) {
      document.body.style.overflow = 'auto';
      clearCustomIconPreviews();
      return;
    }

    document.body.style.overflow = 'hidden';

    return () => {
      document.body.style.overflow = 'auto';
    };
  }, [isOpen, editingItem]);

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

    // レイアウトエントリのウィンドウ選択
    if (layoutEntryWindowSelectorIndex !== null) {
      const currentEntries = [...(item.layoutEntries || [])];
      if (layoutEntryWindowSelectorIndex < currentEntries.length) {
        currentEntries[layoutEntryWindowSelectorIndex] = mergeWindowInfoIntoLayoutEntry(
          currentEntries[layoutEntryWindowSelectorIndex],
          windowInfo
        );
        handleFieldChange('layoutEntries', currentEntries);
      }
      setLayoutEntryWindowSelectorIndex(null);
      setWindowSelectorOpen(false);
      return;
    }

    if (item.itemCategory === 'window') {
      const currentConfig = item.windowOperationConfig;
      const windowOperationConfig = {
        ...currentConfig,
        displayName: item.displayName,
        windowTitle: windowInfo.title,
        processName: windowInfo.processName,
      };
      handleFieldChange('windowOperationConfig', windowOperationConfig);
    } else {
      const currentConfig = item.windowConfig;
      const windowConfig: WindowConfig = {
        ...currentConfig,
        title: windowInfo.title,
        processName: windowInfo.processName,
      };
      handleFieldChange('windowConfig', windowConfig);
    }

    setWindowSelectorOpen(false);
  };

  const fetchFromWindow = async (): Promise<WindowInfo | null> => {
    if (!item) return null;
    return fetchMatchingWindow(item);
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
      } else if (item.itemCategory === 'layout') {
        await window.electronAPI.executeLayout(buildLayoutItemFromRegisterItem(item));
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
      <div
        className={asPage ? 'workspace-editor-page' : 'modal-overlay'}
        onClick={(e) => e.stopPropagation()}
      >
        <div
          className={`modal-content register-modal${asPage ? ' workspace-editor-content' : ''}`}
          onClick={(e) => e.stopPropagation()}
          ref={modalRef}
          tabIndex={-1}
        >
          <h2>{t('workspace.edit.title')}</h2>

          {loading ? (
            <div className="loading">{t('register.loading')}</div>
          ) : item ? (
            <>
              <div className="register-items">
                <div className="register-item">
                  <div className="form-group">
                    <label>{t('register.type')}</label>
                    <select value={item.itemCategory} disabled>
                      <option value="item">{t('register.types.item')}</option>
                      <option value="group">{t('register.types.group')}</option>
                      <option value="window">{t('register.types.window')}</option>
                      <option value="clipboard">{t('register.types.clipboard')}</option>
                      <option value="layout">{t('register.types.layout')}</option>
                    </select>
                  </div>

                  <div className="form-group">
                    <label>{t('register.displayName')}</label>
                    <input
                      type="text"
                      value={item.displayName}
                      className={errors.displayName ? 'error' : ''}
                      onChange={(e) => handleFieldChange('displayName', e.target.value)}
                      placeholder={
                        item.itemCategory === 'group'
                          ? t('register.placeholders.group')
                          : t('register.placeholders.item')
                      }
                    />
                    {errors.displayName && (
                      <span className="error-message">{errors.displayName}</span>
                    )}
                  </div>

                  {/* パスを持つのは通常のアイテムだけ（クリップボードの中身は別ファイル） */}
                  {item.itemCategory === 'item' && (
                    <div className="form-group">
                      <label>{t('register.path')}</label>
                      <input
                        type="text"
                        value={item.path}
                        className={errors.path ? 'error' : ''}
                        onChange={(e) => handleFieldChange('path', e.target.value)}
                        onBlur={() => handlePathBlur()}
                        placeholder={t('register.pathPlaceholder')}
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
                      <label>{t('register.args')}</label>
                      <input
                        type="text"
                        value={item.args || ''}
                        onChange={(e) => handleFieldChange('args', e.target.value)}
                        placeholder={t('register.argsPlaceholder')}
                      />
                    </div>
                  )}

                  {item.itemCategory === 'group' && (
                    <div className="form-group vertical-layout">
                      <label>{t('register.groupItems')}</label>
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
                                  title={t('register.removeGroupItem')}
                                >
                                  x
                                </button>
                              </div>
                            ))}
                          </div>
                        ) : (
                          <div className="no-group-items">{t('register.noGroupItems')}</div>
                        )}
                        <button
                          type="button"
                          className="add-group-item-btn"
                          onClick={handleAddGroupItem}
                        >
                          {t('register.addGroupItem')}
                        </button>
                      </div>
                      {errors.groupItemNames && (
                        <span className="error-message">{errors.groupItemNames}</span>
                      )}
                      <small>{t('workspace.edit.groupItemsHint')}</small>
                    </div>
                  )}

                  {/* グループはカスタムアイコンを保存できない（ワークスペースファイルの形式に項目がない）ので出さない */}
                  {(item.itemCategory === 'item' || item.itemCategory === 'layout') && (
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
                      onFetchFromWindow={fetchFromWindow}
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
                          handleFieldChange(
                            'windowOperationConfig',
                            toWindowOperationConfig(item.displayName, wc)
                          )
                        }
                        onGetWindowClick={() => setWindowSelectorOpen(true)}
                        onFetchFromWindow={fetchFromWindow}
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

                  {item.itemCategory === 'layout' && (
                    <LayoutEntryEditor
                      entries={item.layoutEntries || []}
                      onChange={(entries) => handleFieldChange('layoutEntries', entries)}
                      onCaptureClick={() => setLayoutCaptureOpen(true)}
                      onSelectWindow={(entryIndex) => {
                        setLayoutEntryWindowSelectorIndex(entryIndex);
                        setWindowSelectorOpen(true);
                      }}
                    />
                  )}

                  <div className="form-group">
                    <label>{t('register.note')}</label>
                    <textarea
                      value={item.memo || ''}
                      onChange={(e) => handleFieldChange('memo', e.target.value)}
                      placeholder={t('register.notePlaceholder')}
                      rows={3}
                      className="memo-textarea"
                    />
                  </div>
                </div>
              </div>

              <div className="modal-actions">
                {item.itemCategory !== 'group' && (
                  <Button variant="primary" onClick={handleExecute}>
                    {t('register.tryRun')}
                  </Button>
                )}
                <div className="modal-actions-right">
                  <Button variant="cancel" onClick={handleCancel}>
                    {t('common.cancel')}
                  </Button>
                  <Button variant="primary" onClick={handleSave}>
                    {t('register.update')}
                  </Button>
                </div>
              </div>
            </>
          ) : (
            <div className="loading">{t('workspace.edit.notFound')}</div>
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
        title={t('register.customIconPickerTitle')}
        fileTypes="image"
        description={t('register.customIconPickerDescription')}
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
          if (!item) return;
          const currentEntries = item.layoutEntries || [];
          handleFieldChange('layoutEntries', [...currentEntries, ...entries]);
          setLayoutCaptureOpen(false);
        }}
      />
    </>
  );
};

export default WorkspaceItemEditModal;

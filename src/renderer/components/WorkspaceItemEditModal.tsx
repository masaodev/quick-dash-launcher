import React, { useEffect, useRef, useState } from 'react';
import { useTranslation } from 'react-i18next';
import type { WorkspaceItem, WorkspaceItemUpdate, WindowInfo, WindowConfig } from '@common/types';
import { pickWindowPlacement } from '@common/utils/windowPlacement';

import { useCustomIcon } from '../hooks/useCustomIcon';
import { useModalKeyboard } from '../hooks/useModalKeyboard';
import { useToast } from '../hooks/useToast';
import { useWorkspaceItemEditForm } from '../hooks/workspace/useWorkspaceItemEditForm';
import { logError } from '../utils/debug';
import { getPathsFromDropEvent } from '../utils/fileDropUtils';
import { fetchMatchingWindow } from '../utils/windowFilter';
import { toTrialWorkspaceItem } from '../utils/workspaceTrialItem';

import FilePickerDialog from './FilePickerDialog';
import WindowSelectorModal from './WindowSelectorModal';
import ItemEditFields from './ItemEditFields';
import { Button } from './ui';
import '../styles/components/ItemConverterMenu.css';

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
  const [optionsOpen, setOptionsOpen] = useState(false);
  const [isDraggingOver, setIsDraggingOver] = useState(false);
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
    item,
    loading,
    errors,
    iconFetchLoading,
    handleFieldChange,
    handlePathBlur,
    handleSave,
    handleCancel,
    handleDelete,
    handleFetchIcon,
    replacePathFromDrop,
    updateItem,
  } = useWorkspaceItemEditForm(isOpen, editingItem, loadCustomIconPreview, onClose, onSave);

  // 上に重ねたダイアログ（セットのアイテムの追加など）の Escape は useModalKeyboard がそちらに任せる
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
          ...pickWindowPlacement(item.windowOperationConfig),
        });
      } else {
        // 保存済みの内容ではなく、編集中の内容で試す
        await window.electronAPI.workspaceAPI.launchItem(toTrialWorkspaceItem(editingItem, item));
      }
    } catch (error) {
      logError('アイテムの実行に失敗しました:', error);
    } finally {
      if (pinModeChanged) {
        await window.electronAPI.workspaceAPI.toggleAlwaysOnTop();
      }
    }
  };

  // ファイルのドロップでパスを置き換えられるのは、パスを持つ通常のアイテムだけ
  const acceptsDrop = item?.itemCategory === 'item';

  const handleDragOver = (e: React.DragEvent) => {
    if (!acceptsDrop) return;
    e.preventDefault();
    e.stopPropagation();
    setIsDraggingOver(true);
  };

  const handleDragLeave = (e: React.DragEvent) => {
    if (!acceptsDrop) return;
    e.preventDefault();
    e.stopPropagation();
    const relatedTarget = e.relatedTarget as Node | null;
    if (relatedTarget && e.currentTarget.contains(relatedTarget)) return;
    setIsDraggingOver(false);
  };

  const handleDrop = async (e: React.DragEvent) => {
    if (!acceptsDrop) return;
    e.preventDefault();
    e.stopPropagation();
    setIsDraggingOver(false);
    const paths = getPathsFromDropEvent(e);
    if (paths.length > 0) await replacePathFromDrop(paths[0]);
  };

  if (!isOpen) return null;

  return (
    <>
      <div
        className={asPage ? 'workspace-editor-page' : 'modal-overlay'}
        onClick={(e) => e.stopPropagation()}
      >
        <div
          className={`modal-content register-modal${asPage ? ' workspace-editor-content' : ''}${isDraggingOver ? ' dragging-over' : ''}`}
          onClick={(e) => e.stopPropagation()}
          onDragOver={handleDragOver}
          onDragLeave={handleDragLeave}
          onDrop={handleDrop}
          ref={modalRef}
          tabIndex={-1}
        >
          <h2>{t('workspace.edit.title')}</h2>

          {loading ? (
            <div className="loading">{t('register.loading')}</div>
          ) : item ? (
            <>
              <div className="register-items">
                <ItemEditFields
                  item={item}
                  errors={errors}
                  onFieldChange={handleFieldChange}
                  onUpdate={updateItem}
                  onPathBlur={handlePathBlur}
                  onFetchIcon={handleFetchIcon}
                  typeLocked
                  setIncludesWorkspace
                  isPathReadOnly={false}
                  iconFetchLoading={iconFetchLoading}
                  optionsOpen={optionsOpen}
                  onToggleOptions={() => setOptionsOpen((open) => !open)}
                  customIconPreview={customIconPreviews[0]}
                  onCustomIconSelect={() => openCustomIconPicker(0)}
                  onCustomIconDelete={onCustomIconDeleted}
                  onOpenWindowSelector={() => setWindowSelectorOpen(true)}
                  onFetchFromWindow={fetchFromWindow}
                  onClipboardError={showError}
                  showSeparator={false}
                />
              </div>

              <div className="modal-actions">
                <Button variant="secondary" onClick={handleExecute}>
                  {t('register.tryRun')}
                </Button>
                <div className="modal-actions-right">
                  <Button variant="danger" onClick={handleDelete}>
                    {t('workspace.edit.remove')}
                  </Button>
                  <Button variant="secondary" onClick={handleCancel}>
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

          {isDraggingOver && (
            <div className="drag-overlay">
              <div className="drag-message">{t('workspace.edit.dropToReplacePath')}</div>
            </div>
          )}
        </div>
      </div>

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
    </>
  );
};

export default WorkspaceItemEditModal;

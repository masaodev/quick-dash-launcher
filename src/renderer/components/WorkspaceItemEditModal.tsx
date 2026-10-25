import React, { useEffect, useRef, useState } from 'react';
import { useTranslation } from 'react-i18next';
import type { WorkspaceItem, WorkspaceItemUpdate } from '@common/types';

import { useCustomIcon } from '../hooks/useCustomIcon';
import { useModalKeyboard } from '../hooks/useModalKeyboard';
import { useToast } from '../hooks/useToast';
import {
  useWorkspaceItemEditForm,
  type WorkspaceItemCreate,
} from '../hooks/workspace/useWorkspaceItemEditForm';
import { logError } from '../utils/debug';
import { getPathsFromDropEvent } from '../utils/fileDropUtils';
import { toTrialNewWorkspaceItem, toTrialWorkspaceItem } from '../utils/workspaceTrialItem';
import { isWorkspaceTryExecuteBlocked } from '../utils/registerItemExecution';

import FilePickerDialog from './FilePickerDialog';
import ItemEditFields, { ITEM_CATEGORY_ICONS } from './ItemEditFields';
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
  /**
   * 新規の形で開く（グループの右クリック「新しく入力して追加」）。種別を選べ、保存の代わりに追加する。
   * 削除のボタンは出さない
   */
  create?: WorkspaceItemCreate;
  /** 見出しの上に出す帯（新規のときの追加先） */
  banner?: React.ReactNode;
}

/**
 * ワークスペースアイテム編集フォーム
 *
 * ワークスペースアイテムの全フィールド（path, args, customIcon, ウィンドウ切り替え等）を編集する。
 * 独立した編集ウィンドウ（WorkspaceItemEditPage）に描画される
 */
const WorkspaceItemEditModal: React.FC<WorkspaceItemEditModalProps> = ({
  isOpen,
  onClose,
  editingItem,
  onSave,
  asPage = false,
  create,
  banner,
}) => {
  const { t } = useTranslation();
  const modalRef = useRef<HTMLDivElement>(null);
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
  } = useWorkspaceItemEditForm(isOpen, editingItem, loadCustomIconPreview, onClose, onSave, create);

  /**
   * 「ワークスペースから削除」は、一覧の右クリック・× と同じ確認の子ウィンドウ（この画面が親）で確かめてから消す。
   * 名前は編集中の値ではなく保存済みの名前を出す
   */
  const handleConfirmDelete = async () => {
    if (!editingItem) return;
    const result = await window.electronAPI.workspaceAPI.openConfirm({
      title: t('workspace.edit.removeTitle'),
      message: t('workspace.edit.removeConfirm', { name: editingItem.displayName }),
      confirmText: t('workspace.edit.remove'),
      cancelText: t('common.cancel'),
      danger: true,
    });
    if (result) await handleDelete();
  };

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

  const handleExecute = async () => {
    if (!item || (!editingItem && !create)) return;

    const originalPinMode = await window.electronAPI.workspaceAPI.getAlwaysOnTop();
    let pinModeChanged = false;

    try {
      if (!originalPinMode) {
        await window.electronAPI.workspaceAPI.toggleAlwaysOnTop();
        pinModeChanged = true;
      }

      // 保存済みの内容ではなく、編集中の内容で試す
      await window.electronAPI.workspaceAPI.launchItem(
        editingItem ? toTrialWorkspaceItem(editingItem, item) : toTrialNewWorkspaceItem(item),
        { trial: true }
      );
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
          {banner}
          <h2 className="register-title">
            {item && (
              <span className="register-title-icon" aria-hidden>
                {item.icon ? (
                  <img src={item.icon} alt="" />
                ) : (
                  ITEM_CATEGORY_ICONS[item.itemCategory]
                )}
              </span>
            )}
            {t(create ? 'workspace.edit.newTitle' : 'workspace.edit.title')}
          </h2>

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
                  typeLocked={!create}
                  allowFolderImport={false}
                  setIncludesWorkspace
                  iconFetchLoading={iconFetchLoading}
                  optionsOpen={optionsOpen}
                  onToggleOptions={() => setOptionsOpen((open) => !open)}
                  customIconPreview={customIconPreviews[0]}
                  onCustomIconSelect={() => openCustomIconPicker(0)}
                  onCustomIconDelete={onCustomIconDeleted}
                  onClipboardError={showError}
                  showSeparator={false}
                />
              </div>

              <div className="modal-actions">
                <Button
                  variant="secondary"
                  onClick={handleExecute}
                  disabled={isWorkspaceTryExecuteBlocked(item)}
                  title={
                    isWorkspaceTryExecuteBlocked(item) ? t('register.tryRunDataMissing') : undefined
                  }
                >
                  {t('register.tryRun')}
                </Button>
                <div className="modal-actions-right">
                  {!create && (
                    <Button variant="danger" onClick={() => void handleConfirmDelete()}>
                      {t('workspace.edit.remove')}
                    </Button>
                  )}
                  <Button variant="secondary" onClick={handleCancel}>
                    {t('common.cancel')}
                  </Button>
                  <Button variant="primary" onClick={handleSave}>
                    {t(create ? 'workspace.edit.add' : 'register.update')}
                  </Button>
                </div>
              </div>
            </>
          ) : create ? null : (
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
    </>
  );
};

export default WorkspaceItemEditModal;

/**
 * 画面: アイテム登録・編集モーダル
 * 画面仕様: docs/screens/register-modal.md
 */
import { useTranslation } from 'react-i18next';
import React, { useEffect, useRef, useState } from 'react';
import type { RegisterItem, EditingAppItem, EditableJsonItem, LauncherItem } from '@common/types';
import { isEditableJsonItem, isJsonLauncherItem } from '@common/types';

import { useCustomIcon } from '../hooks/useCustomIcon';
import { useModalKeyboard } from '../hooks/useModalKeyboard';
import { useRegisterForm } from '../hooks/useRegisterForm';
import { useToast } from '../hooks/useToast';
import { getPathsFromDropEvent } from '../utils/fileDropUtils';
import {
  canTryExecute,
  isTryExecuteBlocked,
  tryExecuteRegisterItem,
} from '../utils/registerItemExecution';

import FilePickerDialog from './FilePickerDialog';
import ItemEditFields, { ITEM_CATEGORY_ICONS } from './ItemEditFields';
import RegisterPlacementBar, { describePlacement } from './RegisterPlacementBar';
import { Button } from './ui';
import '../styles/components/ItemConverterMenu.css';

interface RegisterModalProps {
  isOpen: boolean;
  onClose: () => void;
  onRegister: (items: RegisterItem[]) => void;
  droppedPaths: string[];
  editingItem?: EditingAppItem | EditableJsonItem | null;
  /** 新規登録の初期値にするアイテム（ワークスペースのアイテムを登録するとき） */
  prefillItems?: RegisterItem[];
  /** 開いたときにこの種別へ切り替える（管理画面の種類プルダウンから、詳細編集でしか作れない種別を選んだとき） */
  initialCategory?: RegisterItem['itemCategory'];
  currentTab?: string; // 現在開いているタブ
  onDelete?: (item: EditingAppItem | EditableJsonItem) => void; // 削除ハンドラー
  /** 独立した子ウィンドウの中身として描く（オーバーレイなしでウィンドウいっぱいに広げる） */
  asPage?: boolean;
}

/**
 * 編集中のアイテムが自動取込で管理されているかを判定する
 */
function isAutoImportItem(editingItem: EditingAppItem | EditableJsonItem): boolean {
  // EditableJsonItem（管理画面から）
  if (isEditableJsonItem(editingItem)) {
    const jsonItem = editingItem.item;
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
  prefillItems,
  initialCategory,
  currentTab,
  onDelete,
  asPage = false,
}) => {
  const { t } = useTranslation();
  const modalRef = useRef<HTMLDivElement>(null);

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

  const form = useRegisterForm(
    isOpen,
    editingItem,
    droppedPaths,
    prefillItems,
    currentTab,
    loadCustomIconPreview,
    onClose,
    onRegister
  );
  const {
    items,
    loading,
    errors,
    availableTabs,
    dataFileLabels,
    iconFetchLoading,
    handleItemChange,
    validateAndRegister,
    handleCancel,
    updateItem,
    replaceFirstItemFromPath,
  } = form;

  // 種別を指定して開かれたときは、編集対象の読み込みが済んでから種別を切り替える
  useEffect(() => {
    if (!isOpen || !initialCategory || loading || items.length === 0) return;
    if (items[0].itemCategory !== initialCategory) {
      handleItemChange(0, 'itemCategory', initialCategory);
    }
    // items.length と loading の変化だけを契機にする（items 全体を見ると切替のたびに発火する）
  }, [isOpen, initialCategory, loading, items.length]);

  useEffect(() => {
    setOptionsSectionOpen(items.map(() => false));
  }, [items.length]);

  useEffect(() => {
    if (!isOpen) return;

    const resetDragState = () => setIsDraggingOverModal(false);
    document.addEventListener('dragend', resetDragState);
    return () => document.removeEventListener('dragend', resetDragState);
  }, [isOpen]);

  // 上に重ねたダイアログ（グループのアイテム選択・ウィンドウ選択など）の Escape は useModalKeyboard がそちらに任せる
  useModalKeyboard({
    isOpen,
    modalRef,
    onClose: handleCancel,
  });

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
  }, [isOpen]);

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
    // 画面の中のドラッグ（セットの行の並べ替えなど）では、ファイルのドロップ先を出さない
    if (!Array.from(e.dataTransfer.types).includes('Files')) return;
    // セットはドロップで先頭のアイテムを置き換えると行が消えるので、受けない（ワークスペースと同じ）
    if (items[0]?.itemCategory === 'set') return;
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

    if (items.length > 0 && items[0].itemCategory !== 'set') {
      await replaceFirstItemFromPath(paths[0]);
    }
  };

  if (!isOpen) return null;

  // 1 件のときは保存先を上の帯に、種別のアイコンを見出しに出す（複数件は各アイテムの欄に出す）
  const singleItem = !loading && items.length === 1 ? items[0] : undefined;

  return (
    <>
      <div
        className={asPage ? 'main-child-page' : 'modal-overlay'}
        onClick={(e) => e.stopPropagation()}
      >
        <div
          className={`modal-content register-modal${asPage ? ' main-child-content' : ''} ${isDraggingOverModal ? 'dragging-over' : ''}`}
          onClick={(e) => e.stopPropagation()}
          onDragOver={handleModalDragOver}
          onDragLeave={handleModalDragLeave}
          onDrop={handleModalDrop}
          ref={modalRef}
          tabIndex={-1}
        >
          {singleItem && (
            <RegisterPlacementBar
              item={singleItem}
              availableTabs={availableTabs}
              dataFileLabels={dataFileLabels}
              onTargetTabChange={(targetTab) => form.handleTargetTabChange(0, targetTab)}
              onTargetFileChange={(targetFile) => handleItemChange(0, 'targetFile', targetFile)}
            />
          )}

          <h2 className="register-title">
            {singleItem && (
              <span className="register-title-icon" aria-hidden>
                {singleItem.icon ? (
                  <img src={singleItem.icon} alt="" />
                ) : (
                  ITEM_CATEGORY_ICONS[singleItem.itemCategory]
                )}
              </span>
            )}
            {editingItem ? t('register.editTitle') : t('register.addTitle')}
          </h2>

          {editingItem && isAutoImportItem(editingItem) && (
            <div className="auto-import-warning">{t('register.autoImportWarning')}</div>
          )}

          {loading ? (
            <div className="loading">{t('register.loading')}</div>
          ) : (
            <>
              <div className="register-items">
                {items.map((item, index) => (
                  <ItemEditFields
                    key={index}
                    item={item}
                    errors={errors[index]}
                    onFieldChange={(field, value) => handleItemChange(index, field, value)}
                    onUpdate={(fields) => updateItem(index, fields)}
                    onPathBlur={() => form.handlePathBlur(index)}
                    onFetchIcon={() => form.handleFetchIcon(index)}
                    headerInParent={!!singleItem}
                    placement={{
                      availableTabs,
                      dataFileLabels,
                      onTargetTabChange: (targetTab) =>
                        form.handleTargetTabChange(index, targetTab),
                    }}
                    isPathReadOnly={!!droppedPaths && droppedPaths.length > 0}
                    iconFetchLoading={iconFetchLoading[index] || false}
                    optionsOpen={!!optionsSectionOpen[index]}
                    onToggleOptions={() => toggleOptionsSection(index)}
                    customIconPreview={customIconPreviews[index]}
                    onCustomIconSelect={() => openCustomIconPicker(index)}
                    onCustomIconDelete={() => onCustomIconDeleted(index)}
                    onClipboardError={showError}
                    showSeparator={items.length > 1}
                    selfId={
                      editingItem
                        ? isEditableJsonItem(editingItem)
                          ? editingItem.item.id
                          : editingItem.jsonItemId
                        : undefined
                    }
                  />
                ))}
              </div>

              <div className="modal-actions">
                {canTryExecute(items[0]) && (
                  <Button
                    variant="secondary"
                    onClick={() => tryExecuteRegisterItem(items[0])}
                    disabled={isTryExecuteBlocked(items[0])}
                    title={
                      isTryExecuteBlocked(items[0]) ? t('register.tryRunSaveFirst') : undefined
                    }
                  >
                    {t('register.tryRun')}
                  </Button>
                )}
                <div className="modal-actions-right">
                  {singleItem && (
                    <span className="register-dest-echo">
                      {t(editingItem ? 'register.destEchoEdit' : 'register.destEcho', {
                        dest: describePlacement(singleItem, availableTabs, dataFileLabels, t),
                      })}
                    </span>
                  )}
                  {editingItem && onDelete && (
                    <Button variant="danger" onClick={handleDelete}>
                      {t('register.delete')}
                    </Button>
                  )}
                  <Button variant="secondary" onClick={handleCancel}>
                    {t('common.cancel')}
                  </Button>
                  <Button variant="primary" onClick={validateAndRegister}>
                    {editingItem ? t('register.update') : t('register.add')}
                  </Button>
                </div>
              </div>
            </>
          )}

          {isDraggingOverModal && (
            <div className="drag-overlay">
              <div className="drag-message">{t('register.dropFiles')}</div>
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

export default RegisterModal;

import React, { useCallback, useEffect, useRef, useState } from 'react';
import type {
  RegisterItem,
  EditingAppItem,
  EditableJsonItem,
  WindowInfo,
  LauncherItem,
} from '@common/types';
import { isJsonLauncherItem } from '@common/types';
import { mergeWindowInfoIntoLayoutEntry } from '@common/utils/layoutUtils';

import { useCustomIcon } from '../hooks/useCustomIcon';
import { useModalKeyboard } from '../hooks/useModalKeyboard';
import { useRegisterForm } from '../hooks/useRegisterForm';
import { useToast } from '../hooks/useToast';
import { getPathsFromDropEvent } from '../utils/fileDropUtils';
import { canTryExecute, tryExecuteRegisterItem } from '../utils/registerItemExecution';
import { fetchMatchingWindow } from '../utils/windowFilter';

import GroupItemSelectorModal from './GroupItemSelectorModal';
import FilePickerDialog from './FilePickerDialog';
import WindowSelectorModal from './WindowSelectorModal';
import LayoutCaptureModal from './LayoutCaptureModal';
import RegisterItemForm from './RegisterItemForm';
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

  const form = useRegisterForm(
    isOpen,
    editingItem,
    droppedPaths,
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
    selectorModalOpen,
    editingItemIndex,
    iconFetchLoading,
    handleItemChange,
    validateAndRegister,
    handleCancel,
    handleSelectGroupItem,
    updateItem,
    setEditingItemIndex,
    setSelectorModalOpen,
    replaceFirstItemFromPath,
  } = form;

  useEffect(() => {
    setOptionsSectionOpen(items.map(() => false));
  }, [items.length]);

  useEffect(() => {
    if (!isOpen) return;

    const resetDragState = () => setIsDraggingOverModal(false);
    document.addEventListener('dragend', resetDragState);
    return () => document.removeEventListener('dragend', resetDragState);
  }, [isOpen]);

  // GroupItemSelectorModalが表示されている場合は、Escapeはそちらに任せる
  const deferEscapeToGroupSelector = useCallback(
    () => !!document.querySelector('.group-item-selector-modal'),
    []
  );
  useModalKeyboard({
    isOpen,
    modalRef,
    onClose: handleCancel,
    onEscape: deferEscapeToGroupSelector,
  });

  useEffect(() => {
    if (!isOpen) {
      document.body.style.overflow = 'auto';
      window.electronAPI.setModalMode(false);
      clearCustomIconPreviews();
      return;
    }

    document.body.style.overflow = 'hidden';
    return () => {
      document.body.style.overflow = 'auto';
    };
  }, [isOpen]);

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
                  <RegisterItemForm
                    key={index}
                    item={item}
                    index={index}
                    errors={errors[index]}
                    form={form}
                    availableTabs={availableTabs}
                    dataFileLabels={dataFileLabels}
                    isPathReadOnly={!!droppedPaths && droppedPaths.length > 0}
                    iconFetchLoading={iconFetchLoading[index] || false}
                    optionsOpen={!!optionsSectionOpen[index]}
                    onToggleOptions={() => toggleOptionsSection(index)}
                    customIconPreview={customIconPreviews[index]}
                    onCustomIconSelect={() => openCustomIconPicker(index)}
                    onCustomIconDelete={() => onCustomIconDeleted(index)}
                    onOpenWindowSelector={() => openWindowSelector(index)}
                    onFetchFromWindow={() => fetchMatchingWindow(items[index])}
                    onLayoutCapture={() => {
                      setLayoutCaptureItemIndex(index);
                      setLayoutCaptureOpen(true);
                    }}
                    onLayoutEntryWindowSelect={(entryIndex) => {
                      setLayoutEntryWindowSelectorIndex({ itemIndex: index, entryIndex });
                      setWindowSelectorOpen(true);
                    }}
                    onClipboardError={showError}
                    showSeparator={items.length > 1}
                  />
                ))}
              </div>

              <div className="modal-actions">
                {canTryExecute(items[0]) && (
                  <Button variant="primary" onClick={() => tryExecuteRegisterItem(items[0])}>
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

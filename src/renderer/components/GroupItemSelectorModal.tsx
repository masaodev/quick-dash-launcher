import React, { useState, useEffect, useRef, useMemo } from 'react';
import { LauncherItem, AppItem } from '@common/types';
import { isWindowInfo, isGroupItem, isLauncherItem, isWindowItem } from '@common/types/guards';

import { debugInfo, logError } from '../utils/debug';

import { Button } from './ui';

interface GroupItemSelectorModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSelect: (itemName: string) => void;
  targetFile?: string;
  excludeNames: string[];
}

const GroupItemSelectorModal: React.FC<GroupItemSelectorModalProps> = ({
  isOpen,
  onClose,
  onSelect,
  targetFile,
  excludeNames,
}) => {
  const [availableItems, setAvailableItems] = useState<LauncherItem[]>([]);
  const [searchQuery, setSearchQuery] = useState('');
  const modalRef = useRef<HTMLDivElement>(null);
  const searchInputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (!isOpen) {
      setSearchQuery('');
      return;
    }

    loadAvailableItems();

    modalRef.current?.focus();
    setTimeout(() => {
      searchInputRef.current?.focus();
    }, 100);

    const handleKeyDown = (event: KeyboardEvent) => {
      const modal = modalRef.current;
      if (!modal) return;

      if (event.key === 'Escape') {
        event.preventDefault();
        event.stopPropagation();
        event.stopImmediatePropagation();
        onClose();
        return;
      }

      if (event.key === 'Tab') {
        const focusableElements = modal.querySelectorAll(
          'button, [href], input, select, textarea, [tabindex]:not([tabindex="-1"])'
        );
        const firstFocusableElement = focusableElements[0] as HTMLElement;
        const lastFocusableElement = focusableElements[focusableElements.length - 1] as HTMLElement;

        if (event.shiftKey && document.activeElement === firstFocusableElement) {
          lastFocusableElement.focus();
        } else if (!event.shiftKey && document.activeElement === lastFocusableElement) {
          firstFocusableElement.focus();
        }
        event.preventDefault();
        event.stopPropagation();
        event.stopImmediatePropagation();
        return;
      }

      if (!modal.contains(document.activeElement)) return;

      const activeElement = document.activeElement as HTMLElement;
      const isInputField = activeElement?.tagName === 'INPUT';

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
    };

    document.addEventListener('keydown', handleKeyDown, true);

    return () => {
      document.removeEventListener('keydown', handleKeyDown, true);
    };
  }, [isOpen, onClose]);

  const filteredItems = useMemo(() => {
    if (!searchQuery.trim()) return availableItems;
    const query = searchQuery.toLowerCase();
    return availableItems.filter((item) => item.displayName.toLowerCase().includes(query));
  }, [searchQuery, availableItems]);

  const loadAvailableItems = async () => {
    try {
      debugInfo('Loading available items for file:', targetFile);
      const allItems: AppItem[] = await window.electronAPI.loadDataFiles();

      // 対象ファイルのLauncherItemのみを抽出（グループアイテムとフォルダ取込展開アイテムは除外）
      const itemsInFile = allItems.filter((item: AppItem) => {
        if (isWindowInfo(item) || isGroupItem(item)) {
          return false;
        }
        if (!isLauncherItem(item) && !isWindowItem(item)) {
          return false;
        }
        if (isLauncherItem(item) && item.isDirExpanded) {
          return false;
        }
        if (targetFile) {
          return item.sourceFile === targetFile;
        }
        return true;
      }) as LauncherItem[];

      // アイコンを読み込む
      const iconCache = await window.electronAPI.loadCachedIcons(itemsInFile);
      const itemsWithIcons = itemsInFile.map((item) => ({
        ...item,
        icon: iconCache[item.path] || item.icon,
      }));

      debugInfo(
        'Available items:',
        itemsWithIcons.map((item) => item.displayName)
      );
      setAvailableItems(itemsWithIcons);
    } catch (error) {
      logError('Error loading available items:', error);
    }
  };

  const handleSelectItem = (itemName: string) => {
    onSelect(itemName);
    onClose();
  };

  const getDefaultIcon = (item: AppItem): string => {
    if (!('type' in item)) return '❓';

    const iconMap: Record<string, string> = {
      url: '🌐',
      folder: '📁',
      app: '⚙️',
      file: '📄',
      customUri: '🔗',
      window: '🪟',
      group: '📦',
    };
    return iconMap[item.type] || '❓';
  };

  if (!isOpen) return null;

  return (
    <div className="modal-overlay" onClick={onClose}>
      <div
        className="modal-content group-item-selector-modal"
        onClick={(e) => e.stopPropagation()}
        ref={modalRef}
        tabIndex={-1}
      >
        <h3>グループアイテムを選択</h3>

        <div className="search-box">
          <input
            ref={searchInputRef}
            type="text"
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            placeholder="アイテム名で検索..."
          />
        </div>

        <div className="item-list">
          {filteredItems.length === 0 ? (
            <div className="no-items">
              {searchQuery ? '検索結果がありません' : 'このファイルにはアイテムがありません'}
            </div>
          ) : (
            filteredItems.map((item, index) => {
              const excluded = excludeNames.includes(item.displayName);
              return (
                <div
                  key={index}
                  className={`item-row ${excluded ? 'excluded' : ''}`}
                  onClick={() => !excluded && handleSelectItem(item.displayName)}
                >
                  <span className="item-icon">
                    {item.icon ? (
                      <img src={item.icon} alt="" width="24" height="24" />
                    ) : (
                      getDefaultIcon(item)
                    )}
                  </span>
                  <span className="item-name">{item.displayName}</span>
                  {excluded && <span className="excluded-label">追加済み</span>}
                </div>
              );
            })
          )}
        </div>

        <div className="modal-actions">
          <Button variant="cancel" onClick={onClose}>
            キャンセル
          </Button>
        </div>
      </div>
    </div>
  );
};

export default GroupItemSelectorModal;

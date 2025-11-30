import React, { useState, useEffect, useRef } from 'react';

import { RawDataLine } from '../../common/types';
import { debugInfo } from '../utils/debug';

interface GroupItemSelectorModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSelect: (itemName: string) => void;
  targetFile: string; // 対象のデータファイル名
  excludeNames: string[]; // 既に追加済みのアイテム名（選択不可にする）
}

const GroupItemSelectorModal: React.FC<GroupItemSelectorModalProps> = ({
  isOpen,
  onClose,
  onSelect,
  targetFile,
  excludeNames,
}) => {
  const [availableItems, setAvailableItems] = useState<string[]>([]);
  const [filteredItems, setFilteredItems] = useState<string[]>([]);
  const [searchQuery, setSearchQuery] = useState('');
  const modalRef = useRef<HTMLDivElement>(null);
  const searchInputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (!isOpen) {
      setSearchQuery('');
      return;
    }

    // モーダルが開いたときの処理
    loadAvailableItems();

    // フォーカスをモーダルに設定
    modalRef.current?.focus();
    // 検索ボックスにフォーカス
    setTimeout(() => {
      searchInputRef.current?.focus();
    }, 100);

    // キーイベントの制御
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

      // モーダル内でのキーイベントの場合、背景への伝播を完全に阻止
      const isModalFocused = modal.contains(document.activeElement);
      if (isModalFocused) {
        const activeElement = document.activeElement as HTMLElement;
        const isInputField = activeElement && activeElement.tagName === 'INPUT';

        if (isInputField) {
          // 入力フィールドでの通常の編集キーは許可
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
    };
  }, [isOpen, onClose]);

  useEffect(() => {
    // 検索クエリが変更されたらフィルタリング
    if (searchQuery.trim() === '') {
      setFilteredItems(availableItems);
    } else {
      const query = searchQuery.toLowerCase();
      const filtered = availableItems.filter((name) => name.toLowerCase().includes(query));
      setFilteredItems(filtered);
    }
  }, [searchQuery, availableItems]);

  const loadAvailableItems = async () => {
    try {
      debugInfo('Loading available items for file:', targetFile);
      const rawLines: RawDataLine[] = await window.electronAPI.loadRawDataFiles();

      // 対象ファイルのアイテムのみを抽出
      const itemsInFile = rawLines
        .filter((line: RawDataLine) => line.sourceFile === targetFile && line.type === 'item')
        .map((line: RawDataLine) => {
          // アイテム名を抽出（カンマ区切りの最初の要素）
          const parts = line.content.split(',');
          return parts[0]?.trim() || '';
        })
        .filter((name: string) => name !== ''); // 空の名前を除外

      debugInfo('Available items:', itemsInFile);
      setAvailableItems(itemsInFile);
      setFilteredItems(itemsInFile);
    } catch (error) {
      console.error('Error loading available items:', error);
    }
  };

  const handleSelectItem = (itemName: string) => {
    onSelect(itemName);
    onClose();
  };

  const isExcluded = (itemName: string) => {
    return excludeNames.includes(itemName);
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
            filteredItems.map((itemName, index) => {
              const excluded = isExcluded(itemName);
              return (
                <div
                  key={index}
                  className={`item-row ${excluded ? 'excluded' : ''}`}
                  onClick={() => !excluded && handleSelectItem(itemName)}
                >
                  <span className="item-name">{itemName}</span>
                  {excluded && <span className="excluded-label">追加済み</span>}
                </div>
              );
            })
          )}
        </div>

        <div className="modal-actions">
          <button onClick={onClose}>キャンセル</button>
        </div>
      </div>
    </div>
  );
};

export default GroupItemSelectorModal;

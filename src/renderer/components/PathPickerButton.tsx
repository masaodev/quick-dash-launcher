import { useTranslation } from 'react-i18next';
import React, { useEffect, useRef, useState } from 'react';
import type { ItemPathPickKind } from '@common/types';

import { Button } from './ui';

interface PathPickerButtonProps {
  /** folder: フォルダだけを選ぶ（フォルダ取込）。any: ▾ でファイルかフォルダを選ぶ（単一アイテム） */
  mode: 'folder' | 'any';
  /** いま入っているパス（ダイアログをその場所から開く） */
  currentPath: string;
  /** 選んだパスを渡す（やめたときは呼ばない） */
  onPick: (path: string) => void;
}

/**
 * パス欄の横の「選択」ボタン。OS のダイアログでファイルやフォルダを選び、パス欄に入れる。
 * 入力欄は手で打てるまま残し、このボタンは補助にする
 */
const PathPickerButton: React.FC<PathPickerButtonProps> = ({ mode, currentPath, onPick }) => {
  const { t } = useTranslation();
  const [isOpen, setIsOpen] = useState(false);
  const containerRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!isOpen) return;

    const handleClickOutside = (event: MouseEvent) => {
      if (containerRef.current && !containerRef.current.contains(event.target as Node)) {
        setIsOpen(false);
      }
    };
    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.key === 'Escape') {
        // 画面ごと閉じないよう、メニューだけを閉じる
        event.stopPropagation();
        setIsOpen(false);
      }
    };

    document.addEventListener('mousedown', handleClickOutside);
    document.addEventListener('keydown', handleKeyDown, true);
    return () => {
      document.removeEventListener('mousedown', handleClickOutside);
      document.removeEventListener('keydown', handleKeyDown, true);
    };
  }, [isOpen]);

  const pick = async (kind: ItemPathPickKind) => {
    setIsOpen(false);
    const picked = await window.electronAPI.selectItemPath(kind, currentPath);
    if (picked) onPick(picked);
  };

  if (mode === 'folder') {
    return (
      <Button
        variant="secondary"
        size="sm"
        type="button"
        className="path-picker-btn"
        onClick={() => pick('folder')}
        title={t('pathPicker.folderButtonTitle')}
      >
        <span className="path-picker-emoji">📁</span>
        <span>{t('pathPicker.selectFolder')}</span>
      </Button>
    );
  }

  return (
    <div className="item-converter-menu-container" ref={containerRef}>
      <Button
        variant="secondary"
        size="sm"
        type="button"
        className="path-picker-btn"
        aria-haspopup="menu"
        aria-expanded={isOpen}
        onClick={() => setIsOpen((open) => !open)}
        title={t('pathPicker.title')}
      >
        <span className="path-picker-emoji">📁</span>
        <span>{t('pathPicker.select')} ▾</span>
      </Button>

      {isOpen && (
        <div className="item-converter-menu path-picker-menu" role="menu">
          <div className="item-converter-menu-options">
            {(['file', 'folder'] as const).map((kind) => (
              <button
                key={kind}
                type="button"
                role="menuitem"
                className="item-converter-option path-picker-option"
                onClick={() => pick(kind)}
              >
                <span className="item-converter-option-label">
                  {kind === 'file' ? `📄 ${t('pathPicker.file')}` : `📁 ${t('pathPicker.folder')}`}
                </span>
              </button>
            ))}
          </div>
        </div>
      )}
    </div>
  );
};

export default PathPickerButton;

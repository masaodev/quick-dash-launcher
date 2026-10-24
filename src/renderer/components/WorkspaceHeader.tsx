import React, { useState, useRef, useEffect } from 'react';
import { useTranslation } from 'react-i18next';
import type { PinLevel, WorkspacePositionMode } from '@common/types';

import { logError } from '../utils/debug';

import PinButton from './PinButton';

interface WorkspaceHeaderProps {
  isFilterVisible: boolean;
  onToggleFilter: () => void;
  onExpandAll: () => void;
  onCollapseAll: () => void;
  /** ＋（グループ・アイテム・ワークスペースを追加するメニュー）。anchor はボタンの左下の位置 */
  onAddMenu: (anchor: { x: number; y: number }) => void;
  pinLevel: PinLevel;
  onPinLevelChange: (level: PinLevel) => void;
  onClose: () => void;
}

const WorkspaceHeader: React.FC<WorkspaceHeaderProps> = ({
  isFilterVisible,
  onToggleFilter,
  onExpandAll,
  onCollapseAll,
  onAddMenu,
  pinLevel,
  onPinLevelChange,
  onClose,
}) => {
  const { t } = useTranslation();
  const [isSettingsMenuOpen, setIsSettingsMenuOpen] = useState(false);
  const settingsMenuRef = useRef<HTMLDivElement>(null);
  // メニューを開いたときの表示する場所（左端・右端の ✓ に使う）
  const [positionMode, setPositionMode] = useState<WorkspacePositionMode | null>(null);

  const toggleSettingsMenu = async () => {
    if (isSettingsMenuOpen) {
      setIsSettingsMenuOpen(false);
      return;
    }
    try {
      setPositionMode((await window.electronAPI.getSettings()).workspacePositionMode);
    } catch (error) {
      logError('ワークスペースの表示する場所を読めませんでした:', error);
    }
    setIsSettingsMenuOpen(true);
  };

  // 左端・右端に寄せるは設定「表示する場所」を変えるので、今の設定に ✓ を付ける（古い値 primaryLeft・primaryRight も含む）
  const isLeftEdge = positionMode === 'displayLeft' || positionMode === 'primaryLeft';
  const isRightEdge = positionMode === 'displayRight' || positionMode === 'primaryRight';

  // メニュー外クリックで閉じる
  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (settingsMenuRef.current && !settingsMenuRef.current.contains(event.target as Node)) {
        setIsSettingsMenuOpen(false);
      }
    };

    if (isSettingsMenuOpen) {
      document.addEventListener('mousedown', handleClickOutside);
    }

    return () => {
      document.removeEventListener('mousedown', handleClickOutside);
    };
  }, [isSettingsMenuOpen]);

  async function handleMenuAction(action: () => Promise<unknown>): Promise<void> {
    await action();
    setIsSettingsMenuOpen(false);
  }

  return (
    <div className="workspace-header">
      <h1>{t('workspace.title')}</h1>
      <div className="workspace-header-controls">
        <button
          className={`action-btn workspace-control-btn ${isFilterVisible ? 'active' : ''}`}
          onClick={onToggleFilter}
          title={t('workspace.header.filter')}
        >
          🔍
        </button>
        <button
          className="action-btn workspace-control-btn"
          onClick={onExpandAll}
          title={t('workspace.header.expandAll')}
        >
          🔽
        </button>
        <button
          className="action-btn workspace-control-btn"
          onClick={onCollapseAll}
          title={t('workspace.header.collapseAll')}
        >
          🔼
        </button>
        <button
          className="action-btn workspace-control-btn"
          onClick={(e) => {
            const rect = e.currentTarget.getBoundingClientRect();
            onAddMenu({ x: rect.left, y: rect.bottom });
          }}
          title={t('workspace.header.add')}
          data-testid="workspace-add-menu-button"
        >
          ➕
        </button>
        <PinButton
          level={pinLevel}
          onLevelChange={onPinLevelChange}
          className="workspace-pin-btn"
        />
        <div className="workspace-settings-container" ref={settingsMenuRef}>
          <button
            className={`action-btn workspace-control-btn ${isSettingsMenuOpen ? 'active' : ''}`}
            onClick={toggleSettingsMenu}
            title={t('workspace.header.menu')}
          >
            ⚙️
          </button>
          {isSettingsMenuOpen && (
            <div className="workspace-settings-menu">
              <button
                className="workspace-settings-menu-item"
                onClick={() =>
                  handleMenuAction(() => window.electronAPI.openEditWindowWithTab('settings'))
                }
              >
                {t('workspace.header.openSettings')}
              </button>
              <div className="workspace-settings-menu-divider" />
              <button
                className="workspace-settings-menu-item"
                role="menuitemradio"
                aria-checked={isLeftEdge}
                onClick={() =>
                  handleMenuAction(() =>
                    window.electronAPI.workspaceAPI.setPositionMode('displayLeft')
                  )
                }
              >
                {t('workspace.header.alignLeft')}
                {isLeftEdge && <span className="workspace-settings-menu-check">✓</span>}
              </button>
              <button
                className="workspace-settings-menu-item"
                role="menuitemradio"
                aria-checked={isRightEdge}
                onClick={() =>
                  handleMenuAction(() =>
                    window.electronAPI.workspaceAPI.setPositionMode('displayRight')
                  )
                }
              >
                {t('workspace.header.alignRight')}
                {isRightEdge && <span className="workspace-settings-menu-check">✓</span>}
              </button>
            </div>
          )}
        </div>
        <button
          className="action-btn workspace-close-btn"
          onClick={onClose}
          title={t('workspace.header.close')}
        >
          ×
        </button>
      </div>
    </div>
  );
};

export default WorkspaceHeader;

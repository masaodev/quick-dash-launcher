import React from 'react';
import SettingsDropdown from './SettingsDropdown';

interface ActionButtonsProps {
  onFetchFavicon: () => void;
  onExtractAllIcons: () => void;
  onAddTemp: () => void;
  onReload: () => void;
  onOpenConfigFolder: () => void;
  onOpenDataFile: () => void;
  onTogglePin: () => void;
  onExportJson: () => void;
  onSortDataFiles: () => void;
  onToggleEditMode: () => void;
  isPinned: boolean;
  isEditMode: boolean;
}

const ActionButtons: React.FC<ActionButtonsProps> = ({
  onFetchFavicon,
  onExtractAllIcons,
  onAddTemp,
  onReload,
  onOpenConfigFolder,
  onOpenDataFile,
  onTogglePin,
  onExportJson,
  onSortDataFiles,
  onToggleEditMode,
  isPinned,
  isEditMode,
}) => {
  return (
    <div className="action-buttons">
      <button
        className="action-button"
        onClick={onFetchFavicon}
        title="ファビコン取得"
      >
        🌐
      </button>
      <button
        className="action-button"
        onClick={onExtractAllIcons}
        title="全アイコンを抽出"
      >
        🎨
      </button>
      <button
        className="action-button"
        onClick={onAddTemp}
        title="一時タブに追加"
      >
        ✔️
      </button>
      <button
        className="action-button"
        onClick={onReload}
        title="リロード"
      >
        🔄
      </button>
      <button
        className={`action-button ${isPinned ? 'pinned' : ''}`}
        onClick={onTogglePin}
        title={isPinned ? "固定解除" : "ウィンドウを固定"}
      >
        📌
      </button>
      <SettingsDropdown
        onOpenConfigFolder={onOpenConfigFolder}
        onOpenDataFile={onOpenDataFile}
        onExportJson={onExportJson}
        onSortDataFiles={onSortDataFiles}
        onToggleEditMode={onToggleEditMode}
        onQuitApp={() => window.electronAPI.quitApp()}
        isEditMode={isEditMode}
      />
    </div>
  );
};

export default ActionButtons;
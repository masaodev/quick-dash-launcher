import React from 'react';

interface ActionButtonsProps {
  onFetchFavicon: () => void;
  onExtractAllIcons: () => void;
  onAddTemp: () => void;
  onReload: () => void;
  onOpenConfigFolder: () => void;
  onOpenDataFile: () => void;
  onTogglePin: () => void;
  onExportJson: () => void;
  isPinned: boolean;
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
  isPinned,
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
        className="action-button"
        onClick={onOpenConfigFolder}
        title="設定フォルダを開く"
      >
        📁
      </button>
      <button
        className="action-button"
        onClick={onOpenDataFile}
        title="設定ファイルを開く"
      >
        ⚙
      </button>
      <button
        className={`action-button ${isPinned ? 'pinned' : ''}`}
        onClick={onTogglePin}
        title={isPinned ? "固定解除" : "ウィンドウを固定"}
      >
        📌
      </button>
      <button
        className="action-button"
        onClick={onExportJson}
        title="JSON出力"
      >
        📋
      </button>
    </div>
  );
};

export default ActionButtons;
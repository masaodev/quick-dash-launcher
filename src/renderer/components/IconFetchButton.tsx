import React from 'react';

interface IconFetchButtonProps {
  path: string;
  loading: boolean;
  onFetch: () => void;
  itemType: 'url' | 'file' | 'folder' | 'app' | 'customUri' | 'clipboard';
}

const IconFetchButton: React.FC<IconFetchButtonProps> = ({ path, loading, onFetch, itemType }) => {
  const isDisabled = !path?.trim() || loading || itemType === 'folder' || itemType === 'clipboard';

  return (
    <button
      type="button"
      className="icon-fetch-btn"
      onClick={onFetch}
      disabled={isDisabled}
      title="パスからアイコンを自動取得"
    >
      {loading ? (
        <span className="icon-fetch-spinner"></span>
      ) : (
        <span className="icon-fetch-emoji">🎨</span>
      )}
      <span>アイコン取得</span>
    </button>
  );
};

export default IconFetchButton;

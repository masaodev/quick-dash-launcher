import { useTranslation } from 'react-i18next';
import React from 'react';

interface IconFetchButtonProps {
  path: string;
  loading: boolean;
  onFetch: () => void;
  itemType: 'url' | 'file' | 'folder' | 'app' | 'customUri' | 'clipboard';
}

const IconFetchButton: React.FC<IconFetchButtonProps> = ({ path, loading, onFetch, itemType }) => {
  const { t } = useTranslation();
  const isDisabled = !path?.trim() || loading || itemType === 'folder' || itemType === 'clipboard';

  return (
    <button
      type="button"
      className="icon-fetch-btn"
      onClick={onFetch}
      disabled={isDisabled}
      title={t('iconFetch.title')}
    >
      {loading ? (
        <span className="icon-fetch-spinner"></span>
      ) : (
        <span className="icon-fetch-emoji">🎨</span>
      )}
      <span>{t('iconFetch.button')}</span>
    </button>
  );
};

export default IconFetchButton;

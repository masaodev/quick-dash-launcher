import React from 'react';
import { useTranslation } from 'react-i18next';

interface ItemCountDisplayProps {
  count: number;
}

/**
 * アイテム数を表示する専用コンポーネント
 * タブ内やステータスバー等で使用される
 */
const LauncherItemCountDisplay: React.FC<ItemCountDisplayProps> = ({ count }) => {
  const { t } = useTranslation();
  return <span className="item-count-display">{t('common.itemCount', { count })}</span>;
};

export default LauncherItemCountDisplay;

import React from 'react';

interface ItemCountDisplayProps {
  count: number;
}

/**
 * アイテム数を表示する専用コンポーネント
 * タブ内やステータスバー等で使用される
 */
const LauncherItemCountDisplay: React.FC<ItemCountDisplayProps> = ({ count }) => {
  return <span className="item-count-display">{count}件</span>;
};

export default LauncherItemCountDisplay;

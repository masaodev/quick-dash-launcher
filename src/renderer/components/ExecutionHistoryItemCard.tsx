import React from 'react';
import type { ExecutionHistoryItem } from '@common/types';

interface ExecutionHistoryItemCardProps {
  item: ExecutionHistoryItem;
  onLaunch: (item: ExecutionHistoryItem) => void;
  onDragStart: (e: React.DragEvent) => void;
}

const ExecutionHistoryItemCard: React.FC<ExecutionHistoryItemCardProps> = ({
  item,
  onLaunch,
  onDragStart,
}) => {
  const [isDragging, setIsDragging] = React.useState(false);

  const handleClick = () => {
    // ドラッグ中はクリックを無視
    if (!isDragging) {
      onLaunch(item);
    }
  };

  const handleDragStart = (e: React.DragEvent) => {
    setIsDragging(true);
    onDragStart(e);
  };

  const handleDragEnd = () => {
    // ドラッグ終了後、少し待ってからクリック可能にする
    setTimeout(() => {
      setIsDragging(false);
    }, 100);
  };

  const getDefaultIcon = () => {
    switch (item.itemType) {
      case 'url':
        return '🌐';
      case 'folder':
        return '📁';
      case 'app':
        return '⚙️';
      case 'file':
        return '📄';
      case 'customUri':
        return '🔗';
      case 'group':
        return '📦';
      case 'windowOperation':
        return '🪟';
      default:
        return '📄';
    }
  };

  const formatExecutionTime = (timestamp: number) => {
    return new Date(timestamp).toLocaleString('ja-JP', {
      month: 'short',
      day: 'numeric',
      hour: '2-digit',
      minute: '2-digit',
    });
  };

  const getTooltipText = (): string => {
    const lines: string[] = [];

    // パス情報
    lines.push(item.itemPath);

    // 引数情報
    if (item.args) {
      lines.push(`引数: ${item.args}`);
    }

    // 空行を追加
    lines.push('');

    // 実行日時
    const executedDate = new Date(item.executedAt).toLocaleString('ja-JP', {
      year: 'numeric',
      month: '2-digit',
      day: '2-digit',
      hour: '2-digit',
      minute: '2-digit',
      second: '2-digit',
    });
    lines.push(`実行日時: ${executedDate}`);

    return lines.join('\n');
  };

  return (
    <div
      className="workspace-item-card execution-history-item"
      onClick={handleClick}
      draggable
      onDragStart={handleDragStart}
      onDragEnd={handleDragEnd}
      title={getTooltipText()}
    >
      <div className="workspace-item-content">
        {item.icon && <img src={item.icon} alt="" className="workspace-item-icon" />}
        {!item.icon && <div className="workspace-item-icon-placeholder">{getDefaultIcon()}</div>}
        <div className="workspace-item-name">{item.itemName}</div>
      </div>
      <div className="execution-history-time">{formatExecutionTime(item.executedAt)}</div>
    </div>
  );
};

export default ExecutionHistoryItemCard;

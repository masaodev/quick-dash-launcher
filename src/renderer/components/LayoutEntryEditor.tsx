import React, { useState } from 'react';
import type { LayoutWindowEntry } from '@common/types';

import '../styles/components/LayoutEntryEditor.css';

interface LayoutEntryEditorProps {
  entries: LayoutWindowEntry[];
  onChange: (entries: LayoutWindowEntry[]) => void;
  onCaptureClick: () => void;
  onSelectWindow?: (entryIndex: number) => void;
}

/**
 * レイアウトエントリエディタ
 * レイアウト内の各ウィンドウエントリの一覧表示・編集・削除を行う
 */
const LayoutEntryEditor: React.FC<LayoutEntryEditorProps> = ({
  entries,
  onChange,
  onCaptureClick,
  onSelectWindow,
}) => {
  const [expandedIndex, setExpandedIndex] = useState<number | null>(null);

  const updateEntry = (index: number, updates: Partial<LayoutWindowEntry>) => {
    const newEntries = [...entries];
    newEntries[index] = { ...newEntries[index], ...updates };
    onChange(newEntries);
  };

  const removeEntry = (index: number) => {
    onChange(entries.filter((_, i) => i !== index));
    if (expandedIndex === index) setExpandedIndex(null);
    else if (expandedIndex !== null && expandedIndex > index) setExpandedIndex(expandedIndex - 1);
  };

  const handleNumberChange = (
    index: number,
    field: 'x' | 'y' | 'width' | 'height' | 'virtualDesktopNumber',
    value: string
  ) => {
    const num = value === '' ? undefined : parseInt(value, 10);
    updateEntry(index, { [field]: isNaN(num as number) ? undefined : num });
  };

  const toggleExpand = (index: number) => {
    setExpandedIndex(expandedIndex === index ? null : index);
  };

  return (
    <div className="layout-entry-editor">
      <div className="form-group vertical-layout">
        <label>レイアウトエントリ:</label>

        {entries.length === 0 ? (
          <div className="layout-no-entries">ウィンドウがキャプチャされていません</div>
        ) : (
          <div className="layout-entry-list">
            {entries.map((entry, index) => (
              <div key={index} className="layout-entry-item">
                <div className="entry-compact-row">
                  <button
                    type="button"
                    className="entry-expand-btn"
                    onClick={() => toggleExpand(index)}
                    title={expandedIndex === index ? '折りたたむ' : '詳細を展開'}
                  >
                    {expandedIndex === index ? '▼' : '▶'}
                  </button>

                  {entry.icon && (
                    <div className="entry-icon">
                      <img src={entry.icon} alt="" />
                    </div>
                  )}

                  <div className="entry-info">
                    <div className="entry-title" title={entry.windowTitle}>
                      {entry.windowTitle}
                    </div>
                    <div className="entry-details">
                      {entry.processName && (
                        <span title={entry.executablePath}>{entry.processName}</span>
                      )}
                      <div className="entry-position-inputs">
                        <span>X:</span>
                        <input
                          type="number"
                          value={entry.x ?? ''}
                          onChange={(e) => handleNumberChange(index, 'x', e.target.value)}
                          title="X座標"
                        />
                        <span>Y:</span>
                        <input
                          type="number"
                          value={entry.y ?? ''}
                          onChange={(e) => handleNumberChange(index, 'y', e.target.value)}
                          title="Y座標"
                        />
                        <span>W:</span>
                        <input
                          type="number"
                          value={entry.width ?? ''}
                          onChange={(e) => handleNumberChange(index, 'width', e.target.value)}
                          title="幅"
                        />
                        <span>H:</span>
                        <input
                          type="number"
                          value={entry.height ?? ''}
                          onChange={(e) => handleNumberChange(index, 'height', e.target.value)}
                          title="高さ"
                        />
                      </div>
                    </div>
                  </div>

                  <div className="entry-actions">
                    <label className="launch-toggle">
                      <input
                        type="checkbox"
                        checked={entry.launchApp}
                        onChange={(e) => updateEntry(index, { launchApp: e.target.checked })}
                      />
                      起動
                    </label>
                    <button
                      type="button"
                      className="remove-entry-btn"
                      onClick={() => removeEntry(index)}
                      title="削除"
                    >
                      ×
                    </button>
                  </div>
                </div>

                {expandedIndex === index && (
                  <div className="entry-expanded-details">
                    <div className="entry-field">
                      <label>ウィンドウタイトル:</label>
                      <input
                        type="text"
                        value={entry.windowTitle}
                        onChange={(e) => updateEntry(index, { windowTitle: e.target.value })}
                      />
                    </div>
                    <div className="entry-field">
                      <label>プロセス名:</label>
                      <input
                        type="text"
                        value={entry.processName || ''}
                        onChange={(e) =>
                          updateEntry(index, { processName: e.target.value || undefined })
                        }
                      />
                    </div>
                    <div className="entry-field">
                      <label>実行ファイルパス:</label>
                      <input
                        type="text"
                        value={entry.executablePath || ''}
                        onChange={(e) =>
                          updateEntry(index, { executablePath: e.target.value || undefined })
                        }
                      />
                    </div>
                    <div className="entry-field">
                      <label>引数:</label>
                      <input
                        type="text"
                        value={entry.args || ''}
                        onChange={(e) => updateEntry(index, { args: e.target.value || undefined })}
                      />
                    </div>
                    <div className="entry-field">
                      <label>仮想デスクトップ番号:</label>
                      <input
                        type="number"
                        value={entry.virtualDesktopNumber ?? ''}
                        onChange={(e) =>
                          handleNumberChange(index, 'virtualDesktopNumber', e.target.value)
                        }
                        min="1"
                      />
                    </div>
                    {onSelectWindow && (
                      <button
                        type="button"
                        className="add-group-item-btn"
                        onClick={() => onSelectWindow(index)}
                      >
                        ウィンドウを選択
                      </button>
                    )}
                  </div>
                )}
              </div>
            ))}
          </div>
        )}

        <div className="layout-capture-button">
          <button type="button" className="add-group-item-btn" onClick={onCaptureClick}>
            + ウィンドウをキャプチャ
          </button>
        </div>
      </div>
    </div>
  );
};

export default LayoutEntryEditor;

import { useTranslation } from 'react-i18next';
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
  const { t } = useTranslation();
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
        <label>{t('layoutEditor.windows')}</label>

        {entries.length === 0 ? (
          <div className="layout-no-entries">{t('layoutEditor.noEntries')}</div>
        ) : (
          <div className="layout-entry-list">
            {entries.map((entry, index) => (
              <div key={index} className="layout-entry-item">
                <div className="entry-compact-row">
                  <button
                    type="button"
                    className="entry-expand-btn"
                    onClick={() => toggleExpand(index)}
                    title={
                      expandedIndex === index
                        ? t('layoutEditor.collapse')
                        : t('layoutEditor.expand')
                    }
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
                          title={t('layoutEditor.x')}
                        />
                        <span>Y:</span>
                        <input
                          type="number"
                          value={entry.y ?? ''}
                          onChange={(e) => handleNumberChange(index, 'y', e.target.value)}
                          title={t('layoutEditor.y')}
                        />
                        <span>W:</span>
                        <input
                          type="number"
                          value={entry.width ?? ''}
                          onChange={(e) => handleNumberChange(index, 'width', e.target.value)}
                          title={t('layoutEditor.width')}
                        />
                        <span>H:</span>
                        <input
                          type="number"
                          value={entry.height ?? ''}
                          onChange={(e) => handleNumberChange(index, 'height', e.target.value)}
                          title={t('layoutEditor.height')}
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
                      {t('layoutEditor.launch')}
                    </label>
                    <button
                      type="button"
                      className="remove-entry-btn"
                      onClick={() => removeEntry(index)}
                      title={t('layoutEditor.delete')}
                    >
                      ×
                    </button>
                  </div>
                </div>

                {expandedIndex === index && (
                  <div className="entry-expanded-details">
                    <div className="entry-field">
                      <label>{t('layoutEditor.windowTitle')}</label>
                      <input
                        type="text"
                        value={entry.windowTitle}
                        onChange={(e) => updateEntry(index, { windowTitle: e.target.value })}
                      />
                    </div>
                    <div className="entry-field">
                      <label>{t('layoutEditor.processName')}</label>
                      <input
                        type="text"
                        value={entry.processName || ''}
                        onChange={(e) =>
                          updateEntry(index, { processName: e.target.value || undefined })
                        }
                      />
                    </div>
                    <div className="entry-field">
                      <label>{t('layoutEditor.executablePath')}</label>
                      <input
                        type="text"
                        value={entry.executablePath || ''}
                        onChange={(e) =>
                          updateEntry(index, { executablePath: e.target.value || undefined })
                        }
                      />
                    </div>
                    <div className="entry-field">
                      <label>{t('layoutEditor.args')}</label>
                      <input
                        type="text"
                        value={entry.args || ''}
                        onChange={(e) => updateEntry(index, { args: e.target.value || undefined })}
                      />
                    </div>
                    <div className="entry-field">
                      <label>{t('layoutEditor.desktopNumber')}</label>
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
                        {t('layoutEditor.selectWindow')}
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
            {t('layoutEditor.addFromCurrent')}
          </button>
        </div>
      </div>
    </div>
  );
};

export default LayoutEntryEditor;

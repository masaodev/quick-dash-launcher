import React from 'react';
import { DEFAULT_DATA_FILE } from '@common/types';
import type { AppSettings, DataFileTab } from '@common/types';

import type { HandleSettingChange } from '../hooks/useSettingsManager';
import type { UseTabManagerReturn } from '../hooks/tabManager';

import { Button } from './ui';

interface DataFileTabItemProps {
  tab: DataFileTab;
  tabIndex: number;
  allTabs: DataFileTab[];
  isLoading: boolean;
  tabManager: UseTabManagerReturn;
}

/** タブ 1 件分のアコーディオン（ヘッダーと、展開時のデータファイル一覧） */
const DataFileTabItem: React.FC<DataFileTabItemProps> = ({
  tab,
  tabIndex,
  allTabs,
  isLoading,
  tabManager,
}) => {
  const {
    getDefaultTabName,
    getDefaultFileLabel,
    handleMoveTabUp,
    handleMoveTabDown,
    handleTabNameChangeByIndex,
    handleDeleteTab,
    handleAddFileToTab,
    handleRemoveFileFromTab,
    handleCreateAndAddFileToTab,
    getFileLabel,
    handleFileLabelChange,
    toggleTabExpand,
    isTabExpanded,
  } = tabManager;

  const hasMainDataFile = tab.files.includes(DEFAULT_DATA_FILE);
  const expanded = isTabExpanded(tabIndex);
  const allDataFiles = Array.from(new Set(allTabs.flatMap((t) => t.files)));
  const availableFiles = allDataFiles.filter((file) => !tab.files.includes(file));
  const defaultTabName = getDefaultTabName(tab.files[0] || DEFAULT_DATA_FILE);

  return (
    <div className={`tab-accordion-item ${expanded ? 'expanded' : ''}`}>
      {/* タブヘッダー */}
      <div className="tab-accordion-header">
        <button
          type="button"
          className="tab-expand-button"
          onClick={() => toggleTabExpand(tabIndex)}
          title={expanded ? '折りたたむ' : '展開する'}
        >
          {expanded ? '▼' : '▶'}
        </button>

        <span className="tab-accordion-label">タブ名:</span>
        {expanded ? (
          <input
            type="text"
            value={tab.name}
            onChange={(e) => handleTabNameChangeByIndex(tabIndex, e.target.value)}
            className="tab-accordion-name-input"
            placeholder={defaultTabName}
            disabled={isLoading}
          />
        ) : (
          <span className="tab-accordion-name" onClick={() => toggleTabExpand(tabIndex)}>
            {tab.name || defaultTabName}
          </span>
        )}

        {!expanded && <span className="tab-file-count">📄{tab.files.length}</span>}

        <div className="tab-accordion-controls">
          <button
            type="button"
            onClick={() => handleMoveTabUp(tabIndex)}
            className="move-button"
            disabled={tabIndex === 0 || isLoading}
            title="上へ移動"
          >
            ▲
          </button>
          <button
            type="button"
            onClick={() => handleMoveTabDown(tabIndex)}
            className="move-button"
            disabled={tabIndex === allTabs.length - 1 || isLoading}
            title="下へ移動"
          >
            ▼
          </button>
          {!hasMainDataFile && (
            <button
              type="button"
              onClick={() => handleDeleteTab(tabIndex)}
              className="tab-delete-button"
              title="タブを削除"
              disabled={isLoading}
            >
              🗑️
            </button>
          )}
        </div>
      </div>

      {/* タブコンテンツ（展開時のみ表示） */}
      {expanded && (
        <div className="tab-accordion-content">
          {/* データファイル一覧 */}
          <div className="data-file-list">
            {tab.files.map((fileName) => {
              const isLastFile = tab.files.length === 1;
              // data.json は最低 1 つのタブに必要なので、他のタブにもある場合だけ削除できる
              const canDelete =
                fileName === DEFAULT_DATA_FILE &&
                allTabs.some((t, idx) => idx !== tabIndex && t.files.includes(DEFAULT_DATA_FILE));

              return (
                <div key={fileName} className="data-file-item">
                  <div className="data-file-icon">📄</div>
                  <div className="data-file-info">
                    <div className="data-file-label-row">
                      <span className="data-file-label-prefix">データファイル:</span>
                      <input
                        type="text"
                        className="data-file-label-input"
                        placeholder={getDefaultFileLabel(fileName, tab.name)}
                        value={getFileLabel(fileName)}
                        onChange={(e) => handleFileLabelChange(fileName, e.target.value)}
                        disabled={isLoading}
                      />
                    </div>
                    <span className="data-file-physical-name">{fileName}</span>
                  </div>
                  <div className="data-file-actions">
                    {!canDelete ? (
                      <span
                        className="data-file-default-badge"
                        title="datafiles/data.jsonは最低1つのタブに必要です"
                      >
                        既定
                      </span>
                    ) : (
                      <button
                        type="button"
                        onClick={() => handleRemoveFileFromTab(tabIndex, fileName)}
                        className="data-file-delete-button"
                        disabled={isLoading || isLastFile}
                        title={
                          isLastFile
                            ? 'タブには最低1つのデータファイルが必要です'
                            : 'このデータファイルを削除'
                        }
                      >
                        削除
                      </button>
                    )}
                  </div>
                </div>
              );
            })}
          </div>

          {/* データファイル追加エリア */}
          <div className="data-file-add-section">
            <select
              className="data-file-select"
              defaultValue=""
              onChange={(e) => {
                if (e.target.value) {
                  handleAddFileToTab(tabIndex, e.target.value);
                  e.target.value = '';
                }
              }}
              disabled={isLoading || availableFiles.length === 0}
            >
              <option value="">
                {availableFiles.length > 0
                  ? '既存データファイルを追加...'
                  : '追加可能なデータファイルはありません'}
              </option>
              {availableFiles.map((file) => (
                <option key={file} value={file}>
                  {file}
                </option>
              ))}
            </select>
            <button
              type="button"
              onClick={() => handleCreateAndAddFileToTab(tabIndex)}
              className="data-file-create-button"
              disabled={isLoading}
            >
              ＋ 新規データファイル作成
            </button>
          </div>
        </div>
      )}
    </div>
  );
};

interface AdminSettingsTabsSectionProps {
  editedSettings: AppSettings;
  isLoading: boolean;
  handleSettingChange: HandleSettingChange;
  tabManager: UseTabManagerReturn;
}

/** 設定画面「タブ管理」: 複数タブ表示とタブ・データファイルの構成 */
const AdminSettingsTabsSection: React.FC<AdminSettingsTabsSectionProps> = ({
  editedSettings,
  isLoading,
  handleSettingChange,
  tabManager,
}) => {
  const { handleAddTab, hasUnsavedChanges, handleSaveTabChanges, handleCancelTabChanges } =
    tabManager;
  const tabs = editedSettings.dataFileTabs || [];

  return (
    <>
      <div className="settings-section">
        <h3>タブ表示</h3>
        <div className="setting-item">
          <label>
            <input
              type="checkbox"
              checked={editedSettings.showDataFileTabs}
              onChange={(e) => handleSettingChange('showDataFileTabs', e.target.checked)}
              disabled={isLoading}
            />
            複数タブを表示
          </label>
          <div className="setting-description">
            有効にすると、メイン画面でタブを切り替えて異なるデータファイルを表示できます。
          </div>
        </div>

        {editedSettings.showDataFileTabs && (
          <div className="tab-accordion-container">
            {tabs.map((tab, tabIndex) => (
              <DataFileTabItem
                key={tabIndex}
                tab={tab}
                tabIndex={tabIndex}
                allTabs={tabs}
                isLoading={isLoading}
                tabManager={tabManager}
              />
            ))}

            {/* 新規タブ追加ボタン */}
            <button
              type="button"
              onClick={handleAddTab}
              className="tab-add-button"
              disabled={isLoading}
            >
              ＋ 新規タブを追加
            </button>
          </div>
        )}
      </div>

      {/* タブ管理の保存/キャンセルボタン */}
      {editedSettings.showDataFileTabs && (
        <div className="tab-management-actions">
          {hasUnsavedChanges && <span className="unsaved-indicator">未保存の変更があります</span>}
          <Button
            variant="cancel"
            onClick={() => handleCancelTabChanges()}
            disabled={!hasUnsavedChanges || isLoading}
          >
            ↩️ キャンセル
          </Button>
          <Button
            variant="primary"
            onClick={handleSaveTabChanges}
            disabled={!hasUnsavedChanges || isLoading}
          >
            💾 保存
          </Button>
        </div>
      )}
    </>
  );
};

export default AdminSettingsTabsSection;

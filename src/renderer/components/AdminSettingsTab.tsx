import React, { useState, useEffect, useCallback } from 'react';
import { AppSettings, WindowPositionMode, WorkspacePositionMode } from '@common/types';

import { useDialogManager } from '../hooks/useDialogManager';
import { useSettingsManager } from '../hooks/useSettingsManager';
import { useTabManager } from '../hooks/useTabManager';

import AlertDialog from './AlertDialog';
import ConfirmDialog from './ConfirmDialog';
import { HotkeyInput } from './HotkeyInput';
import { Button } from './ui';

interface SettingsTabProps {
  settings: AppSettings;
  onSave: (settings: AppSettings) => Promise<void>;
}

const AdminSettingsTab: React.FC<SettingsTabProps> = ({ settings, onSave }) => {
  const [editedSettings, setEditedSettings] = useState<AppSettings>(settings);
  const [dataFiles, setDataFiles] = useState<string[]>([]);
  const [selectedCategory, setSelectedCategory] = useState<string>('basic');

  // settingsプロパティが変更されたときにeditedSettingsを更新
  useEffect(() => {
    setEditedSettings(settings);
  }, [settings]);

  // カスタムフック: ダイアログ管理
  const {
    alertDialog,
    showAlert,
    closeAlert,
    confirmDialog,
    showConfirm,
    handleConfirm,
    handleCancelConfirm,
    toast,
  } = useDialogManager();

  // カスタムフック: 基本設定管理
  const {
    hotkeyValidation,
    isLoading,
    handleSettingChange,
    handleNumberInputChange,
    handleNumberInputBlur,
    handleHotkeyValidation,
    handleReset,
  } = useSettingsManager({
    settings,
    editedSettings,
    setEditedSettings,
    onSave,
    showAlert,
    showToast: toast.success,
  });

  // カスタムフック: タブ管理
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
    handleAddTab,
    getFileLabel,
    handleFileLabelChange,
    hasUnsavedChanges: hasUnsavedTabChanges,
    handleSaveTabChanges,
    handleCancelTabChanges,
    toggleTabExpand,
    isTabExpanded,
  } = useTabManager({
    editedSettings,
    setEditedSettings,
    handleSettingChange,
    showAlert,
    showConfirm,
    dataFiles,
  });

  // 設定に基づいてデータファイルリストを生成（設定ファイル基準）
  useEffect(() => {
    const tabs = editedSettings.dataFileTabs || [];
    // 全タブの全ファイルを統合してユニークなリストを作成
    const allFiles = tabs.flatMap((tab) => tab.files);
    const fileNames = Array.from(new Set(allFiles));

    setDataFiles(fileNames);
  }, [editedSettings, getDefaultTabName]);

  // カテゴリ切り替えハンドラ
  const handleCategoryChange = useCallback(
    async (newCategory: string) => {
      // タブ管理カテゴリから離脱する際、未保存の変更がある場合は警告
      if (selectedCategory === 'tabs' && hasUnsavedTabChanges) {
        const confirmed = await showConfirm(
          'タブ管理に未保存の変更があります。変更を破棄してカテゴリを切り替えますか？',
          {
            title: '未保存の変更',
            confirmText: 'カテゴリを切り替える',
            cancelText: 'キャンセル',
            danger: true,
          }
        );

        if (!confirmed) return;

        // 変更を破棄（確認済みなのでスキップ）
        await handleCancelTabChanges(true);
      }

      setSelectedCategory(newCategory);
    },
    [selectedCategory, hasUnsavedTabChanges, showConfirm, handleCancelTabChanges]
  );

  return (
    <div className="settings-tab">
      {isLoading && <div className="loading-overlay">処理中...</div>}

      <div className="settings-with-sidebar">
        {/* 左側メニュー */}
        <div className="settings-sidebar">
          <nav className="settings-menu">
            <button
              className={`menu-item ${selectedCategory === 'basic' ? 'active' : ''}`}
              onClick={() => handleCategoryChange('basic')}
            >
              ⚙️ 基本設定
            </button>
            <button
              className={`menu-item ${selectedCategory === 'window' ? 'active' : ''}`}
              onClick={() => handleCategoryChange('window')}
            >
              🪟 ウィンドウ
            </button>
            <button
              className={`menu-item ${selectedCategory === 'tabs' ? 'active' : ''}`}
              onClick={() => handleCategoryChange('tabs')}
            >
              📑 タブ管理
            </button>
            <button
              className={`menu-item ${selectedCategory === 'backup' ? 'active' : ''}`}
              onClick={() => handleCategoryChange('backup')}
            >
              💾 バックアップ
            </button>
          </nav>
        </div>

        {/* 右側コンテンツ */}
        <div className="settings-content">
          {/* 基本設定 */}
          {selectedCategory === 'basic' && (
            <>
              <div className="settings-section">
                <h3>ホットキー</h3>
                <div className="setting-item">
                  <label htmlFor="hotkey">グローバルホットキー:</label>
                  <HotkeyInput
                    value={editedSettings.hotkey}
                    onChange={(hotkey) => handleSettingChange('hotkey', hotkey)}
                    onValidationChange={handleHotkeyValidation}
                    disabled={isLoading}
                    placeholder="Alt+Space"
                  />
                  {!hotkeyValidation.isValid && (
                    <div className="validation-error">{hotkeyValidation.reason}</div>
                  )}
                </div>
              </div>

              <div className="settings-section">
                <h3>システム</h3>
                <div className="setting-item">
                  <label>
                    <input
                      type="checkbox"
                      checked={editedSettings.autoLaunch}
                      onChange={(e) => handleSettingChange('autoLaunch', e.target.checked)}
                      disabled={isLoading}
                    />
                    起動時に自動実行
                  </label>
                </div>
              </div>

              <div className="settings-section">
                <h3>グループ起動</h3>
                <div className="setting-item">
                  <label>
                    <input
                      type="checkbox"
                      checked={editedSettings.parallelGroupLaunch}
                      onChange={(e) => handleSettingChange('parallelGroupLaunch', e.target.checked)}
                      disabled={isLoading}
                    />
                    グループアイテムを並列起動
                  </label>
                  <div className="setting-description">
                    有効にすると、グループ内のアイテムを順次実行せずに並列で起動します。起動速度が向上しますが、順序が保証されません。
                  </div>
                </div>
              </div>
            </>
          )}

          {/* ウィンドウ */}
          {selectedCategory === 'window' && (
            <>
              <div className="settings-section">
                <h3>ウィンドウサイズ</h3>
                <div className="window-size-grid">
                  <div className="window-size-group">
                    <div className="window-size-group-title">メイン画面</div>
                    <div className="window-size-inputs">
                      <div className="window-size-field">
                        <label htmlFor="windowWidth">幅:</label>
                        <input
                          id="windowWidth"
                          type="number"
                          min="400"
                          max="2000"
                          value={editedSettings.windowWidth}
                          onChange={(e) => handleNumberInputChange('windowWidth', e.target.value)}
                          onBlur={handleNumberInputBlur}
                          disabled={isLoading}
                        />
                        <span className="unit">px</span>
                      </div>
                      <div className="window-size-field">
                        <label htmlFor="windowHeight">高さ:</label>
                        <input
                          id="windowHeight"
                          type="number"
                          min="300"
                          max="1200"
                          value={editedSettings.windowHeight}
                          onChange={(e) => handleNumberInputChange('windowHeight', e.target.value)}
                          onBlur={handleNumberInputBlur}
                          disabled={isLoading}
                        />
                        <span className="unit">px</span>
                      </div>
                    </div>
                  </div>
                  <div className="window-size-group">
                    <div className="window-size-group-title">管理画面</div>
                    <div className="window-size-inputs">
                      <div className="window-size-field">
                        <label htmlFor="editModeWidth">幅:</label>
                        <input
                          id="editModeWidth"
                          type="number"
                          min="800"
                          max="2000"
                          value={editedSettings.editModeWidth}
                          onChange={(e) => handleNumberInputChange('editModeWidth', e.target.value)}
                          onBlur={handleNumberInputBlur}
                          disabled={isLoading}
                        />
                        <span className="unit">px</span>
                      </div>
                      <div className="window-size-field">
                        <label htmlFor="editModeHeight">高さ:</label>
                        <input
                          id="editModeHeight"
                          type="number"
                          min="600"
                          max="1200"
                          value={editedSettings.editModeHeight}
                          onChange={(e) =>
                            handleNumberInputChange('editModeHeight', e.target.value)
                          }
                          onBlur={handleNumberInputBlur}
                          disabled={isLoading}
                        />
                        <span className="unit">px</span>
                      </div>
                    </div>
                  </div>
                </div>
              </div>

              <div className="settings-section">
                <h3>ウィンドウ表示位置</h3>
                <div className="setting-item">
                  <div className="position-options">
                    <label className="position-option">
                      <input
                        type="radio"
                        name="windowPositionMode"
                        value="center"
                        checked={editedSettings.windowPositionMode === 'center'}
                        onChange={(e) =>
                          handleSettingChange(
                            'windowPositionMode',
                            e.target.value as WindowPositionMode
                          )
                        }
                        disabled={isLoading}
                      />
                      <div className="option-content">
                        <div className="option-title">画面中央（固定）</div>
                        <div className="option-description">
                          常にプライマリモニターの中央にウィンドウを表示します
                        </div>
                      </div>
                    </label>
                    <label className="position-option">
                      <input
                        type="radio"
                        name="windowPositionMode"
                        value="cursorMonitorCenter"
                        checked={editedSettings.windowPositionMode === 'cursorMonitorCenter'}
                        onChange={(e) =>
                          handleSettingChange(
                            'windowPositionMode',
                            e.target.value as WindowPositionMode
                          )
                        }
                        disabled={isLoading}
                      />
                      <div className="option-content">
                        <div className="option-title">画面中央（自動切替）</div>
                        <div className="option-description">
                          マウスカーソルがあるモニターの中央にウィンドウを表示します（マルチモニター推奨）
                        </div>
                      </div>
                    </label>
                    <label className="position-option">
                      <input
                        type="radio"
                        name="windowPositionMode"
                        value="cursor"
                        checked={editedSettings.windowPositionMode === 'cursor'}
                        onChange={(e) =>
                          handleSettingChange(
                            'windowPositionMode',
                            e.target.value as WindowPositionMode
                          )
                        }
                        disabled={isLoading}
                      />
                      <div className="option-content">
                        <div className="option-title">カーソル付近</div>
                        <div className="option-description">
                          マウスカーソルの近くにウィンドウを表示します（検索入力がしやすい位置）
                        </div>
                      </div>
                    </label>
                    <label className="position-option">
                      <input
                        type="radio"
                        name="windowPositionMode"
                        value="fixed"
                        checked={editedSettings.windowPositionMode === 'fixed'}
                        onChange={(e) =>
                          handleSettingChange(
                            'windowPositionMode',
                            e.target.value as WindowPositionMode
                          )
                        }
                        disabled={isLoading}
                      />
                      <div className="option-content">
                        <div className="option-title">固定位置（手動設定）</div>
                        <div className="option-description">
                          ウィンドウを移動した位置を記憶して、次回も同じ位置に表示します
                        </div>
                      </div>
                    </label>
                  </div>
                </div>
              </div>

              <div className="settings-section">
                <h3>ワークスペースウィンドウ</h3>

                {/* 自動表示設定 */}
                <div className="setting-item">
                  <label>
                    <input
                      type="checkbox"
                      checked={editedSettings.autoShowWorkspace}
                      onChange={(e) => handleSettingChange('autoShowWorkspace', e.target.checked)}
                      disabled={isLoading}
                    />
                    メイン画面表示時にワークスペースを自動表示
                  </label>
                  <div className="setting-description">
                    有効にすると、メイン画面を開いたときにワークスペースが非表示なら自動で表示します。
                  </div>
                </div>

                {/* 表示位置設定 */}
                <div className="setting-item">
                  <label>表示位置:</label>
                  <div className="position-options">
                    <label className="position-option">
                      <input
                        type="radio"
                        name="workspacePositionMode"
                        value="primaryLeft"
                        checked={editedSettings.workspacePositionMode === 'primaryLeft'}
                        onChange={(e) =>
                          handleSettingChange(
                            'workspacePositionMode',
                            e.target.value as WorkspacePositionMode
                          )
                        }
                        disabled={isLoading}
                      />
                      <div className="option-content">
                        <div className="option-title">プライマリディスプレイの左端</div>
                        <div className="option-description">
                          プライマリモニターの左端にワークスペースを固定配置します
                        </div>
                      </div>
                    </label>
                    <label className="position-option">
                      <input
                        type="radio"
                        name="workspacePositionMode"
                        value="primaryRight"
                        checked={editedSettings.workspacePositionMode === 'primaryRight'}
                        onChange={(e) =>
                          handleSettingChange(
                            'workspacePositionMode',
                            e.target.value as WorkspacePositionMode
                          )
                        }
                        disabled={isLoading}
                      />
                      <div className="option-content">
                        <div className="option-title">
                          プライマリディスプレイの右端（デフォルト）
                        </div>
                        <div className="option-description">
                          プライマリモニターの右端にワークスペースを固定配置します（既存の動作）
                        </div>
                      </div>
                    </label>
                    <label className="position-option">
                      <input
                        type="radio"
                        name="workspacePositionMode"
                        value="fixed"
                        checked={editedSettings.workspacePositionMode === 'fixed'}
                        onChange={(e) =>
                          handleSettingChange(
                            'workspacePositionMode',
                            e.target.value as WorkspacePositionMode
                          )
                        }
                        disabled={isLoading}
                      />
                      <div className="option-content">
                        <div className="option-title">固定位置（手動設定）</div>
                        <div className="option-description">
                          ワークスペースを移動した位置を記憶して、次回も同じ位置に表示します
                        </div>
                      </div>
                    </label>
                  </div>
                </div>

                {/* 透過度設定 */}
                <div className="setting-item">
                  <label htmlFor="workspaceOpacity">透過度:</label>
                  <div className="opacity-control">
                    <input
                      id="workspaceOpacity"
                      type="range"
                      min="0"
                      max="100"
                      value={editedSettings.workspaceOpacity}
                      onChange={(e) =>
                        handleSettingChange('workspaceOpacity', parseInt(e.target.value))
                      }
                      disabled={isLoading}
                      className="opacity-slider"
                    />
                    <span className="opacity-value">{editedSettings.workspaceOpacity}%</span>
                  </div>
                  <div className="setting-description">
                    ワークスペースウィンドウの透過度を調整します（0%=完全透明、100%=完全不透明）。
                  </div>
                </div>

                <div className="setting-item">
                  <label>
                    <input
                      type="checkbox"
                      checked={editedSettings.workspaceBackgroundTransparent}
                      onChange={(e) =>
                        handleSettingChange('workspaceBackgroundTransparent', e.target.checked)
                      }
                      disabled={isLoading}
                    />
                    背景のみを透過（アイテムやグループは通常表示）
                  </label>
                  <div className="setting-description">
                    有効にすると、背景のみが透過され、アイテムやグループは通常通り表示されます。
                  </div>
                </div>
              </div>
            </>
          )}

          {/* バックアップ */}
          {selectedCategory === 'backup' && (
            <>
              <div className="settings-section">
                <h3>バックアップ</h3>
                <div className="setting-item">
                  <label>
                    <input
                      type="checkbox"
                      checked={editedSettings.backupEnabled}
                      onChange={(e) => handleSettingChange('backupEnabled', e.target.checked)}
                      disabled={isLoading}
                    />
                    バックアップ機能を有効にする
                  </label>
                </div>

                {editedSettings.backupEnabled && (
                  <>
                    <div className="setting-item indent">
                      <label>
                        <input
                          type="checkbox"
                          checked={editedSettings.backupOnStart}
                          onChange={(e) => handleSettingChange('backupOnStart', e.target.checked)}
                          disabled={isLoading}
                        />
                        アプリ起動時にバックアップを作成
                      </label>
                    </div>

                    <div className="setting-item indent">
                      <label>
                        <input
                          type="checkbox"
                          checked={editedSettings.backupOnEdit}
                          onChange={(e) => handleSettingChange('backupOnEdit', e.target.checked)}
                          disabled={isLoading}
                        />
                        データ編集時にバックアップを作成
                      </label>
                    </div>

                    <div className="setting-item indent">
                      <label htmlFor="backupInterval">最小バックアップ間隔:</label>
                      <input
                        id="backupInterval"
                        type="number"
                        min="1"
                        max="60"
                        value={editedSettings.backupInterval}
                        onChange={(e) => handleNumberInputChange('backupInterval', e.target.value)}
                        onBlur={handleNumberInputBlur}
                        disabled={isLoading}
                      />
                      <span className="unit">分</span>
                    </div>

                    <div className="setting-item indent">
                      <label htmlFor="backupRetention">バックアップ保存件数:</label>
                      <input
                        id="backupRetention"
                        type="number"
                        min="1"
                        max="100"
                        value={editedSettings.backupRetention}
                        onChange={(e) => handleNumberInputChange('backupRetention', e.target.value)}
                        onBlur={handleNumberInputBlur}
                        disabled={isLoading}
                      />
                      <span className="unit">件</span>
                    </div>
                  </>
                )}
              </div>
            </>
          )}

          {/* タブ管理 */}
          {selectedCategory === 'tabs' && (
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
                    {/* タブ一覧（アコーディオン） */}
                    {(editedSettings.dataFileTabs || []).map((tab, tabIndex) => {
                      const hasMainDataFile = tab.files.includes('data.json');
                      const expanded = isTabExpanded(tabIndex);
                      const availableFiles = dataFiles.filter(
                        (file: string) => !tab.files.includes(file)
                      );

                      return (
                        <div
                          key={tabIndex}
                          className={`tab-accordion-item ${expanded ? 'expanded' : ''}`}
                        >
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
                                onChange={(e) =>
                                  handleTabNameChangeByIndex(tabIndex, e.target.value)
                                }
                                className="tab-accordion-name-input"
                                placeholder={getDefaultTabName(tab.files[0] || 'data.json')}
                                disabled={isLoading}
                              />
                            ) : (
                              <span
                                className="tab-accordion-name"
                                onClick={() => toggleTabExpand(tabIndex)}
                              >
                                {tab.name || getDefaultTabName(tab.files[0] || 'data.json')}
                              </span>
                            )}

                            {!expanded && (
                              <span className="tab-file-count">📄{tab.files.length}</span>
                            )}

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
                                disabled={
                                  tabIndex === (editedSettings.dataFileTabs || []).length - 1 ||
                                  isLoading
                                }
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
                                  const isMainDataFile = fileName === 'data.json';
                                  const isLastFile = tab.files.length === 1;
                                  // data.jsonが他のタブにも存在するかチェック
                                  const mainDataFileExistsInOtherTabs =
                                    isMainDataFile &&
                                    (editedSettings.dataFileTabs || []).some(
                                      (t, idx) => idx !== tabIndex && t.files.includes('data.json')
                                    );
                                  // data.jsonが他のタブにも存在する場合は削除可能
                                  const canDelete = mainDataFileExistsInOtherTabs;

                                  return (
                                    <div key={fileName} className="data-file-item">
                                      <div className="data-file-icon">📄</div>
                                      <div className="data-file-info">
                                        <div className="data-file-label-row">
                                          <span className="data-file-label-prefix">
                                            データファイル:
                                          </span>
                                          <input
                                            type="text"
                                            className="data-file-label-input"
                                            placeholder={getDefaultFileLabel(fileName, tab.name)}
                                            value={getFileLabel(fileName)}
                                            onChange={(e) =>
                                              handleFileLabelChange(fileName, e.target.value)
                                            }
                                            disabled={isLoading}
                                          />
                                        </div>
                                        <span className="data-file-physical-name">{fileName}</span>
                                      </div>
                                      <div className="data-file-actions">
                                        {!canDelete ? (
                                          <span
                                            className="data-file-default-badge"
                                            title="data.txtは最低1つのタブに必要です"
                                          >
                                            既定
                                          </span>
                                        ) : (
                                          <button
                                            type="button"
                                            onClick={() =>
                                              handleRemoveFileFromTab(tabIndex, fileName)
                                            }
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
                                  {availableFiles.map((file: string) => (
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
                    })}

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
                  <Button
                    variant="primary"
                    onClick={handleSaveTabChanges}
                    disabled={!hasUnsavedTabChanges || isLoading}
                  >
                    💾 保存
                  </Button>
                  <Button
                    variant="cancel"
                    onClick={() => handleCancelTabChanges()}
                    disabled={!hasUnsavedTabChanges || isLoading}
                  >
                    ↩️ キャンセル
                  </Button>
                  {hasUnsavedTabChanges && (
                    <span className="unsaved-indicator">未保存の変更があります</span>
                  )}
                </div>
              )}
            </>
          )}
        </div>
      </div>

      <div className="settings-footer">
        <button className="reset-button" onClick={handleReset} disabled={isLoading}>
          リセット
        </button>
      </div>

      <AlertDialog
        isOpen={alertDialog.isOpen}
        onClose={closeAlert}
        message={alertDialog.message}
        type={alertDialog.type}
      />

      <ConfirmDialog
        isOpen={confirmDialog.isOpen}
        onClose={handleCancelConfirm}
        onConfirm={handleConfirm}
        message={confirmDialog.message}
        title={confirmDialog.title}
        confirmText={confirmDialog.confirmText}
        cancelText={confirmDialog.cancelText}
        danger={confirmDialog.danger}
      />
    </div>
  );
};

export default AdminSettingsTab;

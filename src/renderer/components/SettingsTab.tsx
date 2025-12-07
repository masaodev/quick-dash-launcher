import React, { useState, useEffect } from 'react';
import { AppSettings, WindowPositionMode } from '@common/types';

import { useDialogManager } from '../hooks/useDialogManager';
import { useSettingsManager } from '../hooks/useSettingsManager';
import { useTabManager } from '../hooks/useTabManager';

import AlertDialog from './AlertDialog';
import { HotkeyInput } from './HotkeyInput';

interface SettingsTabProps {
  settings: AppSettings;
  onSave: (settings: AppSettings) => Promise<void>;
}

const SettingsTab: React.FC<SettingsTabProps> = ({ settings, onSave }) => {
  const [editedSettings, setEditedSettings] = useState<AppSettings>(settings);
  const [dataFiles, setDataFiles] = useState<string[]>([]);

  // settingsプロパティが変更されたときにeditedSettingsを更新
  useEffect(() => {
    setEditedSettings(settings);
  }, [settings]);

  // カスタムフック: ダイアログ管理
  const { alertDialog, showAlert, closeAlert } = useDialogManager();

  // カスタムフック: 基本設定管理
  const {
    hotkeyValidation,
    isLoading,
    handleSettingChange,
    handleNumberInputChange,
    handleNumberInputBlur,
    handleHotkeyValidation,
    handleReset,
    handleOpenConfigFolder,
  } = useSettingsManager({
    settings,
    editedSettings,
    setEditedSettings,
    onSave,
    showAlert,
  });

  // カスタムフック: タブ管理
  const {
    fileModalTabIndex,
    getDefaultTabName,
    handleTabNameBlur,
    handleMoveTabUp,
    handleMoveTabDown,
    handleTabNameChangeByIndex,
    handleDeleteTab,
    handleAddFileToTab,
    handleRemoveFileFromTab,
    handleCreateAndAddFileToTab,
    handleAddTab,
    openFileModal,
    closeFileModal,
  } = useTabManager({
    editedSettings,
    setEditedSettings,
    handleSettingChange,
    showAlert,
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

  return (
    <div className="settings-tab">
      {isLoading && <div className="loading-overlay">処理中...</div>}

      <div className="settings-content">
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
          <h3>ウィンドウサイズ</h3>
          <div className="setting-row">
            <div className="setting-item">
              <label htmlFor="windowWidth">通常時の幅:</label>
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
            <div className="setting-item">
              <label htmlFor="windowHeight">通常時の高さ:</label>
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
          <div className="setting-row">
            <div className="setting-item">
              <label htmlFor="editModeWidth">アイテム管理時の幅:</label>
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
            <div className="setting-item">
              <label htmlFor="editModeHeight">アイテム管理時の高さ:</label>
              <input
                id="editModeHeight"
                type="number"
                min="600"
                max="1200"
                value={editedSettings.editModeHeight}
                onChange={(e) => handleNumberInputChange('editModeHeight', e.target.value)}
                onBlur={handleNumberInputBlur}
                disabled={isLoading}
              />
              <span className="unit">px</span>
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
                    handleSettingChange('windowPositionMode', e.target.value as WindowPositionMode)
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
                    handleSettingChange('windowPositionMode', e.target.value as WindowPositionMode)
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
                    handleSettingChange('windowPositionMode', e.target.value as WindowPositionMode)
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
                    handleSettingChange('windowPositionMode', e.target.value as WindowPositionMode)
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
          </div>

          {editedSettings.showDataFileTabs && (
            <>
              <div className="setting-item indent">
                <label>タブ管理:</label>
                <div className="setting-description">
                  複数のタブを作成して切り替えることができます。各タブにカスタムタブ名を設定できます。
                </div>
                <div className="data-file-manager">
                  <div className="data-file-actions">
                    <button type="button" onClick={handleAddTab} className="add-file-button">
                      ➕ 新規タブを追加
                    </button>
                    <button
                      type="button"
                      onClick={handleOpenConfigFolder}
                      className="open-config-button"
                    >
                      📁 フォルダを開く
                    </button>
                  </div>

                  <div className="data-file-table">
                    <div className="data-file-table-header">
                      <div className="column-order">順序</div>
                      <div className="column-tabname">タブ名</div>
                      <div className="column-delete">削除</div>
                      <div className="column-files">ファイル管理</div>
                    </div>

                    {(editedSettings.dataFileTabs || []).map((tab, tabIndex) => {
                      const hasDataTxt = tab.files.includes('data.txt');
                      return (
                        <div key={tabIndex} className="data-file-table-row">
                          <div className="column-order">
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
                          </div>
                          <div className="column-tabname">
                            <input
                              type="text"
                              value={tab.name}
                              onChange={(e) => handleTabNameChangeByIndex(tabIndex, e.target.value)}
                              onBlur={handleTabNameBlur}
                              className="tab-name-input"
                              placeholder={`タブ ${tabIndex + 1}`}
                              disabled={isLoading}
                            />
                          </div>
                          <div className="column-delete">
                            {!hasDataTxt && (
                              <button
                                type="button"
                                onClick={() => handleDeleteTab(tabIndex)}
                                className="delete-tab-button-text"
                                title="タブを削除"
                                disabled={isLoading}
                              >
                                🗑️ 削除
                              </button>
                            )}
                          </div>
                          <div className="column-files">
                            <button
                              type="button"
                              onClick={() => openFileModal(tabIndex)}
                              className="manage-files-button"
                              title="ファイルを管理"
                              disabled={isLoading}
                            >
                              📁 ({tab.files.length}個)
                            </button>
                          </div>
                        </div>
                      );
                    })}
                  </div>
                </div>
              </div>

              <div className="setting-item indent">
                <div className="setting-description">
                  「📁 ファイル管理」ボタンでタブに関連付けるファイルを管理できます。
                </div>
              </div>
            </>
          )}

          {/* ファイル管理モーダル */}
          {fileModalTabIndex !== null && (
            <div className="modal-overlay" onClick={closeFileModal}>
              <div className="modal-content" onClick={(e) => e.stopPropagation()}>
                <div className="modal-header">
                  <h3>
                    「{(editedSettings.dataFileTabs || [])[fileModalTabIndex]?.name || 'タブ'}」の
                    ファイル管理
                  </h3>
                  <button type="button" onClick={closeFileModal} className="modal-close-button">
                    ✕
                  </button>
                </div>

                <div className="modal-body">
                  {(() => {
                    const tab = (editedSettings.dataFileTabs || [])[fileModalTabIndex];
                    if (!tab) return null;

                    const allExistingFiles = dataFiles;
                    const availableFiles = allExistingFiles.filter(
                      (file: string) => !tab.files.includes(file)
                    );

                    return (
                      <>
                        <div className="modal-section">
                          <h4>関連ファイル一覧</h4>
                          <div className="file-list">
                            {tab.files.map((fileName) => (
                              <div key={fileName} className="file-list-item">
                                <div className="file-info">
                                  <span className="file-name">{fileName}</span>
                                </div>
                                <div className="file-actions">
                                  {tab.files.length > 1 && (
                                    <button
                                      type="button"
                                      onClick={() =>
                                        handleRemoveFileFromTab(fileModalTabIndex, fileName)
                                      }
                                      className="btn-danger-sm"
                                      disabled={isLoading}
                                    >
                                      削除
                                    </button>
                                  )}
                                </div>
                              </div>
                            ))}
                          </div>
                        </div>

                        <div className="modal-section">
                          <h4>ファイルを追加</h4>
                          <div className="add-file-section">
                            {availableFiles.length > 0 && (
                              <div className="add-existing-file-group">
                                <select
                                  className="file-select-modal"
                                  defaultValue=""
                                  onChange={(e) => {
                                    if (e.target.value) {
                                      handleAddFileToTab(fileModalTabIndex, e.target.value);
                                      e.target.value = '';
                                    }
                                  }}
                                  disabled={isLoading}
                                >
                                  <option value="">既存ファイルを選択...</option>
                                  {availableFiles.map((file: string) => (
                                    <option key={file} value={file}>
                                      {file}
                                    </option>
                                  ))}
                                </select>
                              </div>
                            )}
                            <button
                              type="button"
                              onClick={() => handleCreateAndAddFileToTab(fileModalTabIndex)}
                              className="btn-primary"
                              disabled={isLoading}
                            >
                              ➕ 新規ファイルを作成して追加
                            </button>
                          </div>
                        </div>

                        <div className="modal-info">
                          <p>
                            <strong>関連ファイル:</strong>{' '}
                            このタブで表示されるアイテムの元となるファイルです。
                          </p>
                        </div>
                      </>
                    );
                  })()}
                </div>

                <div className="modal-footer">
                  <button type="button" onClick={closeFileModal} className="btn-primary">
                    閉じる
                  </button>
                </div>
              </div>
            </div>
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
    </div>
  );
};

export default SettingsTab;

import React, { useState, useEffect } from 'react';

import { AppSettings } from '../../common/types';

import { HotkeyInput } from './HotkeyInput';

interface SettingsTabProps {
  settings: AppSettings;
  onSave: (settings: AppSettings) => Promise<void>;
  onUnsavedChanges: (hasChanges: boolean) => void;
}

const SettingsTab: React.FC<SettingsTabProps> = ({ settings, onSave, onUnsavedChanges }) => {
  const [editedSettings, setEditedSettings] = useState<AppSettings>(settings);
  const [hotkeyValidation, setHotkeyValidation] = useState<{ isValid: boolean; reason?: string }>({
    isValid: true,
  });
  const [isLoading, setIsLoading] = useState(false);
  const [hasChanges, setHasChanges] = useState(false);
  const [dataFiles, setDataFiles] = useState<string[]>([]);
  const [_configFolder, setConfigFolder] = useState<string>('');

  // settingsプロパティが変更されたときにeditedSettingsを更新
  useEffect(() => {
    setEditedSettings(settings);
  }, [settings]);

  // 変更検知
  useEffect(() => {
    const changed = JSON.stringify(settings) !== JSON.stringify(editedSettings);
    setHasChanges(changed);
    onUnsavedChanges(changed);
  }, [settings, editedSettings, onUnsavedChanges]);

  // データファイルリストとconfigフォルダパスをロード
  useEffect(() => {
    const loadDataFilesInfo = async () => {
      try {
        const files = await window.electronAPI.getDataFiles();
        const folder = await window.electronAPI.getConfigFolder();
        setDataFiles(files);
        setConfigFolder(folder);
      } catch (error) {
        console.error('データファイル情報の取得に失敗しました:', error);
      }
    };
    loadDataFilesInfo();
  }, []);

  // 設定項目の変更ハンドラ
  const handleSettingChange = <K extends keyof AppSettings>(key: K, value: AppSettings[K]) => {
    setEditedSettings({
      ...editedSettings,
      [key]: value,
    });
  };

  // ホットキーバリデーション結果の処理
  const handleHotkeyValidation = (isValid: boolean, reason?: string) => {
    setHotkeyValidation({ isValid, reason });
  };

  // 設定保存
  const handleSave = async () => {
    if (!hotkeyValidation.isValid) {
      return;
    }

    try {
      setIsLoading(true);
      await onSave(editedSettings);
      setHasChanges(false);
      onUnsavedChanges(false);
    } catch (error) {
      console.error('設定の保存に失敗しました:', error);
      alert('設定の保存に失敗しました。');
    } finally {
      setIsLoading(false);
    }
  };

  // 設定リセット
  const handleReset = async () => {
    if (!confirm('設定をデフォルト値にリセットしますか？')) {
      return;
    }

    try {
      setIsLoading(true);
      await window.electronAPI.resetSettings();
      const resetSettings = await window.electronAPI.getSettings();
      setEditedSettings(resetSettings);
    } catch (error) {
      console.error('設定のリセットに失敗しました:', error);
      alert('設定のリセットに失敗しました。');
    } finally {
      setIsLoading(false);
    }
  };

  // 変更を元に戻す
  const handleRevert = () => {
    if (hasChanges && confirm('変更を元に戻しますか？')) {
      setEditedSettings(settings);
    }
  };

  // 設定フォルダを開く
  const handleOpenConfigFolder = async () => {
    try {
      await window.electronAPI.openConfigFolder();
    } catch (error) {
      console.error('設定フォルダを開くのに失敗しました:', error);
      alert('設定フォルダを開くのに失敗しました。');
    }
  };

  // 行追加（即座にファイルを作成）
  const handleAddNewFile = async () => {
    // 次のファイル名を自動決定
    const existingNumbers = dataFiles
      .map((file) => {
        const match = file.match(/^data(\d+)\.txt$/i); // 大文字小文字を区別しない
        return match ? parseInt(match[1]) : null;
      })
      .filter((n): n is number => n !== null);

    const nextNumber = existingNumbers.length > 0 ? Math.max(...existingNumbers) + 1 : 2;
    const fileName = `data${nextNumber}.txt`;

    try {
      const result = await window.electronAPI.createDataFile(fileName);
      if (result.success) {
        // リストを更新
        const updatedFiles = await window.electronAPI.getDataFiles();
        setDataFiles(updatedFiles);
      } else {
        alert(result.error || 'ファイルの作成に失敗しました。');
      }
    } catch (error) {
      console.error('データファイルの追加に失敗しました:', error);
      alert('データファイルの追加に失敗しました。');
    }
  };

  // タブ名を変更
  const handleTabNameChange = (fileName: string, tabName: string) => {
    const updatedTabNames = {
      ...(editedSettings.dataFileTabNames || {}),
      [fileName]: tabName,
    };
    handleSettingChange('dataFileTabNames', updatedTabNames);
  };

  // データファイルを削除
  const handleDeleteDataFile = async (fileName: string) => {
    if (fileName === 'data.txt') {
      alert('data.txtは削除できません。');
      return;
    }

    if (!confirm(`${fileName}を削除しますか？\nファイル内のデータは完全に失われます。`)) {
      return;
    }

    try {
      const result = await window.electronAPI.deleteDataFile(fileName);
      if (result.success) {
        // リストを更新
        const updatedFiles = await window.electronAPI.getDataFiles();
        setDataFiles(updatedFiles);
      } else {
        alert(result.error || 'ファイルの削除に失敗しました。');
      }
    } catch (error) {
      console.error('データファイルの削除に失敗しました:', error);
      alert('データファイルの削除に失敗しました。');
    }
  };

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
                onChange={(e) => handleSettingChange('windowWidth', parseInt(e.target.value))}
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
                onChange={(e) => handleSettingChange('windowHeight', parseInt(e.target.value))}
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
                onChange={(e) => handleSettingChange('editModeWidth', parseInt(e.target.value))}
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
                onChange={(e) => handleSettingChange('editModeHeight', parseInt(e.target.value))}
                disabled={isLoading}
              />
              <span className="unit">px</span>
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
                  onChange={(e) => handleSettingChange('backupInterval', parseInt(e.target.value))}
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
                  onChange={(e) => handleSettingChange('backupRetention', parseInt(e.target.value))}
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
              複数データファイルをタブで表示
            </label>
            <div className="setting-description">
              ONにすると、メインウィンドウに各データファイル（data.txt、data2.txt等）のタブが表示されます。
              OFFの場合はdata.txtのみ表示されます。
            </div>
          </div>

          {editedSettings.showDataFileTabs && (
            <>
              <div className="setting-item indent">
                <label>データファイル管理:</label>
                <div className="setting-description">
                  複数のデータファイルを作成して、タブで切り替えることができます。各ファイルにカスタムタブ名を設定できます。
                </div>
                <div className="data-file-manager">
                  <div className="data-file-actions">
                    <button type="button" onClick={handleAddNewFile} className="add-file-button">
                      ➕ 行追加
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
                      <div className="column-filename">ファイル名</div>
                      <div className="column-tabname">タブ名</div>
                      <div className="column-actions">操作</div>
                    </div>

                    {dataFiles.map((fileName) => (
                      <div key={fileName} className="data-file-table-row">
                        <div className="column-filename">
                          <span className="data-file-name">{fileName}</span>
                        </div>
                        <div className="column-tabname">
                          <input
                            type="text"
                            value={editedSettings.dataFileTabNames?.[fileName] || ''}
                            onChange={(e) => handleTabNameChange(fileName, e.target.value)}
                            className="tab-name-input"
                            placeholder={fileName}
                            disabled={isLoading}
                          />
                        </div>
                        <div className="column-actions">
                          {fileName !== 'data.txt' && (
                            <button
                              type="button"
                              onClick={() => handleDeleteDataFile(fileName)}
                              className="delete-file-button"
                              title="削除"
                            >
                              🗑️
                            </button>
                          )}
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              </div>

              <div className="setting-item indent">
                <label htmlFor="defaultFileTab">デフォルトタブ:</label>
                <input
                  id="defaultFileTab"
                  type="text"
                  value={editedSettings.defaultFileTab}
                  onChange={(e) => handleSettingChange('defaultFileTab', e.target.value)}
                  disabled={isLoading}
                  placeholder="data.txt"
                />
                <div className="setting-description">
                  アプリ起動時に最初に表示するタブのファイル名を指定します。
                </div>
              </div>

              <div className="setting-item indent">
                <label>タブの表示順序:</label>
                <div className="setting-description">
                  タブの並び順を変更できます。未設定の場合はファイル名順で表示されます。
                </div>
                <div className="tab-order-editor">
                  <div className="tab-name-note">※ タブ順序の編集機能は今後実装予定です</div>
                </div>
              </div>
            </>
          )}
        </div>
      </div>

      <div className="settings-footer">
        <button className="reset-button" onClick={handleReset} disabled={isLoading}>
          リセット
        </button>
        <div className="button-group">
          <button
            className="revert-button"
            onClick={handleRevert}
            disabled={isLoading || !hasChanges}
          >
            元に戻す
          </button>
          <button
            className="save-button"
            onClick={handleSave}
            disabled={isLoading || !hasChanges || !hotkeyValidation.isValid}
          >
            保存
          </button>
        </div>
      </div>
    </div>
  );
};

export default SettingsTab;

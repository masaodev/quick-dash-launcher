import React, { useState, useEffect, useCallback } from 'react';

import { AppSettings, DataFileTab } from '../../common/types';

import { HotkeyInput } from './HotkeyInput';

interface SettingsTabProps {
  settings: AppSettings;
  onSave: (settings: AppSettings) => Promise<void>;
}

const SettingsTab: React.FC<SettingsTabProps> = ({ settings, onSave }) => {
  const [editedSettings, setEditedSettings] = useState<AppSettings>(settings);
  const [hotkeyValidation, setHotkeyValidation] = useState<{ isValid: boolean; reason?: string }>({
    isValid: true,
  });
  const [isLoading, setIsLoading] = useState(false);
  const [dataFiles, setDataFiles] = useState<string[]>([]);

  // デフォルトのタブ名を生成（data.txt→メイン, data2.txt→サブ1, data3.txt→サブ2, ...）
  const getDefaultTabName = useCallback((fileName: string): string => {
    if (fileName === 'data.txt') {
      return 'メイン';
    }
    const match = fileName.match(/^data(\d+)\.txt$/);
    if (match) {
      const num = parseInt(match[1]);
      return `サブ${num - 1}`;
    }
    return fileName;
  }, []);

  // settingsプロパティが変更されたときにeditedSettingsを更新
  useEffect(() => {
    setEditedSettings(settings);
  }, [settings]);

  // 設定項目の変更ハンドラ（即座に保存）をメモ化
  const handleSettingChange = useCallback(
    async <K extends keyof AppSettings>(key: K, value: AppSettings[K]) => {
      const newSettings = {
        ...editedSettings,
        [key]: value,
      };
      setEditedSettings(newSettings);

      // 即座に保存
      try {
        await onSave(newSettings);
      } catch (error) {
        console.error('設定の保存に失敗しました:', error);
        alert('設定の保存に失敗しました。');
      }
    },
    [editedSettings, onSave]
  );

  // 設定に基づいてデータファイルリストを生成（設定ファイル基準）
  useEffect(() => {
    const tabs = editedSettings.dataFileTabs || [];
    const fileNames = tabs.map((tab) => tab.file);

    // data.txtが設定に含まれていない場合は追加
    if (!fileNames.includes('data.txt')) {
      const updatedTabs = [{ file: 'data.txt', name: getDefaultTabName('data.txt') }, ...tabs];
      handleSettingChange('dataFileTabs', updatedTabs);
      return; // 設定更新後に再度このuseEffectが呼ばれるのでここで終了
    }

    setDataFiles(fileNames);
  }, [editedSettings.dataFileTabs, getDefaultTabName, handleSettingChange]);

  // dataFileTabsの順序でファイルをソート（配列の順序がそのまま表示順序）
  const getSortedDataFiles = (): string[] => {
    return dataFiles; // dataFilesは既にdataFileTabsの順序で生成されている
  };

  // ホットキーバリデーション結果の処理
  const handleHotkeyValidation = (isValid: boolean, reason?: string) => {
    setHotkeyValidation({ isValid, reason });
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

  // 設定フォルダを開く
  const handleOpenConfigFolder = async () => {
    try {
      await window.electronAPI.openConfigFolder();
    } catch (error) {
      console.error('設定フォルダを開くのに失敗しました:', error);
      alert('設定フォルダを開くのに失敗しました。');
    }
  };

  // 行追加（物理ファイル作成 + 設定に追加）
  const handleAddNewFile = async () => {
    // 次のファイル名を自動決定
    const existingNumbers = dataFiles
      .map((file) => {
        if (file === 'data.txt') {
          return 1; // data.txt は番号1として扱う
        }
        const match = file.match(/^data(\d+)\.txt$/i); // 大文字小文字を区別しない
        return match ? parseInt(match[1]) : null;
      })
      .filter((n): n is number => n !== null);

    const nextNumber = existingNumbers.length > 0 ? Math.max(...existingNumbers) + 1 : 2;
    const fileName = `data${nextNumber}.txt`;

    try {
      // 物理ファイルを作成（既存の場合はエラーになるが無視）
      await window.electronAPI.createDataFile(fileName);
    } catch (_error) {
      // ファイル作成エラーは無視（既存ファイルの場合）
      console.warn(`${fileName}は既に存在する可能性があります`);
    }

    // 設定に追加（物理ファイルの存在に関わらず実行）
    const newTab: DataFileTab = {
      file: fileName,
      name: getDefaultTabName(fileName),
    };
    const updatedTabs = [...(editedSettings.dataFileTabs || []), newTab];

    await handleSettingChange('dataFileTabs', updatedTabs);
  };

  // タブ名を変更
  const handleTabNameChange = (fileName: string, tabName: string) => {
    const updatedTabs = (editedSettings.dataFileTabs || []).map((tab) =>
      tab.file === fileName ? { ...tab, name: tabName } : tab
    );
    handleSettingChange('dataFileTabs', updatedTabs);
  };

  // データファイルを削除
  const handleDeleteDataFile = async (fileName: string) => {
    if (fileName === 'data.txt') {
      alert('data.txtは削除できません。');
      return;
    }

    if (!confirm(`${fileName}を削除しますか？\n設定とファイル内のデータは完全に失われます。`)) {
      return;
    }

    try {
      // 物理ファイルを削除
      const result = await window.electronAPI.deleteDataFile(fileName);
      if (result.success) {
        // 設定から削除
        const updatedTabs = (editedSettings.dataFileTabs || []).filter(
          (tab) => tab.file !== fileName
        );

        const newSettings = {
          ...editedSettings,
          dataFileTabs: updatedTabs,
        };
        setEditedSettings(newSettings);

        try {
          await onSave(newSettings);
        } catch (error) {
          console.error('設定の保存に失敗しました:', error);
          alert('設定の保存に失敗しました。');
        }
      } else {
        alert(result.error || 'ファイルの削除に失敗しました。');
      }
    } catch (error) {
      console.error('データファイルの削除に失敗しました:', error);
      alert('データファイルの削除に失敗しました。');
    }
  };

  // タブを上に移動
  const handleMoveUp = (fileName: string) => {
    const tabs = editedSettings.dataFileTabs || [];
    const index = tabs.findIndex((tab) => tab.file === fileName);

    if (index <= 0) return; // 最初の要素または見つからない場合は何もしない

    // 配列を入れ替え
    const newTabs = [...tabs];
    [newTabs[index - 1], newTabs[index]] = [newTabs[index], newTabs[index - 1]];

    handleSettingChange('dataFileTabs', newTabs);
  };

  // タブを下に移動
  const handleMoveDown = (fileName: string) => {
    const tabs = editedSettings.dataFileTabs || [];
    const index = tabs.findIndex((tab) => tab.file === fileName);

    if (index < 0 || index >= tabs.length - 1) return; // 最後の要素または見つからない場合は何もしない

    // 配列を入れ替え
    const newTabs = [...tabs];
    [newTabs[index], newTabs[index + 1]] = [newTabs[index + 1], newTabs[index]];

    handleSettingChange('dataFileTabs', newTabs);
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
                      <div className="column-order">順序</div>
                      <div className="column-filename">ファイル名</div>
                      <div className="column-tabname">タブ名</div>
                      <div className="column-actions">操作</div>
                    </div>

                    {getSortedDataFiles().map((fileName, index) => (
                      <div key={fileName} className="data-file-table-row">
                        <div className="column-order">
                          <button
                            type="button"
                            onClick={() => handleMoveUp(fileName)}
                            className="move-button"
                            disabled={index === 0 || isLoading}
                            title="上へ移動"
                          >
                            ▲
                          </button>
                          <button
                            type="button"
                            onClick={() => handleMoveDown(fileName)}
                            className="move-button"
                            disabled={index === getSortedDataFiles().length - 1 || isLoading}
                            title="下へ移動"
                          >
                            ▼
                          </button>
                        </div>
                        <div className="column-filename">
                          <span className="data-file-name">{fileName}</span>
                        </div>
                        <div className="column-tabname">
                          <input
                            type="text"
                            value={
                              (editedSettings.dataFileTabs || []).find(
                                (tab) => tab.file === fileName
                              )?.name || ''
                            }
                            onChange={(e) => handleTabNameChange(fileName, e.target.value)}
                            className="tab-name-input"
                            placeholder={getDefaultTabName(fileName)}
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
                <div className="setting-description">
                  上記のテーブルの「順序」列にある▲▼ボタンで、タブの表示順序を変更できます。
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
      </div>
    </div>
  );
};

export default SettingsTab;

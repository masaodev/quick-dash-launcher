import React, { useState, useEffect, useCallback } from 'react';
import { AppSettings, DataFileTab, WindowPositionMode } from '@common/types';

import { logWarn } from '../utils/debug';

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
  const [fileModalTabIndex, setFileModalTabIndex] = useState<number | null>(null); // ファイル管理モーダルを開いているタブのインデックス

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

  // 数値入力の変更ハンドラ（ローカル状態のみ更新）
  const handleNumberInputChange = useCallback(
    <K extends keyof AppSettings>(key: K, value: string) => {
      const numValue = parseInt(value);
      if (!isNaN(numValue)) {
        setEditedSettings((prev) => ({
          ...prev,
          [key]: numValue,
        }));
      }
    },
    []
  );

  // 数値入力のフォーカス喪失ハンドラ（保存処理）
  const handleNumberInputBlur = useCallback(async () => {
    try {
      await onSave(editedSettings);
    } catch (error) {
      console.error('設定の保存に失敗しました:', error);
      alert('設定の保存に失敗しました。');
    }
  }, [editedSettings, onSave]);

  // 設定に基づいてデータファイルリストを生成（設定ファイル基準）
  useEffect(() => {
    const tabs = editedSettings.dataFileTabs || [];
    // 全タブの全ファイルを統合してユニークなリストを作成
    const allFiles = tabs.flatMap((tab) => tab.files);
    const fileNames = Array.from(new Set(allFiles));

    // data.txtが設定に含まれていない場合は追加
    if (!fileNames.includes('data.txt')) {
      const updatedTabs = [
        { files: ['data.txt'], name: getDefaultTabName('data.txt'), defaultFile: 'data.txt' },
        ...tabs,
      ];
      const newSettings = {
        ...editedSettings,
        dataFileTabs: updatedTabs,
      };
      setEditedSettings(newSettings);

      // 即座に保存
      onSave(newSettings).catch((error) => {
        console.error('設定の保存に失敗しました:', error);
        alert('設定の保存に失敗しました。');
      });
      return; // 設定更新後に再度このuseEffectが呼ばれるのでここで終了
    }

    setDataFiles(fileNames);
  }, [editedSettings, getDefaultTabName, onSave]);

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
      logWarn(`${fileName}は既に存在する可能性があります`);
    }

    // 設定に追加（物理ファイルの存在に関わらず実行）
    const newTab: DataFileTab = {
      files: [fileName],
      name: getDefaultTabName(fileName),
      defaultFile: fileName,
    };
    const updatedTabs = [...(editedSettings.dataFileTabs || []), newTab];

    await handleSettingChange('dataFileTabs', updatedTabs);
  };

  // タブ名を変更（ローカル状態のみ更新）
  const handleTabNameChange = (fileName: string, tabName: string) => {
    const updatedTabs = (editedSettings.dataFileTabs || []).map((tab) =>
      tab.files.includes(fileName) ? { ...tab, name: tabName } : tab
    );
    setEditedSettings((prev) => ({
      ...prev,
      dataFileTabs: updatedTabs,
    }));
  };

  // タブ名のフォーカス喪失ハンドラ（保存処理）
  const handleTabNameBlur = useCallback(async () => {
    try {
      await onSave(editedSettings);
    } catch (error) {
      console.error('設定の保存に失敗しました:', error);
      alert('設定の保存に失敗しました。');
    }
  }, [editedSettings, onSave]);

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
        // 設定から削除：ファイルが含まれるタブを見つけて、そのファイルを削除
        const updatedTabs = (editedSettings.dataFileTabs || [])
          .map((tab) => {
            if (tab.files.includes(fileName)) {
              const newFiles = tab.files.filter((f) => f !== fileName);
              // タブから全ファイルが削除された場合はタブごと削除
              if (newFiles.length === 0) {
                return null;
              }
              // デフォルトファイルが削除された場合は、最初のファイルを設定
              const newDefaultFile =
                tab.defaultFile === fileName ? newFiles[0] : tab.defaultFile;
              return { ...tab, files: newFiles, defaultFile: newDefaultFile };
            }
            return tab;
          })
          .filter((tab): tab is DataFileTab => tab !== null);

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
    const index = tabs.findIndex((tab) => tab.files.includes(fileName));

    if (index <= 0) return; // 最初の要素または見つからない場合は何もしない

    // 配列を入れ替え
    const newTabs = [...tabs];
    [newTabs[index - 1], newTabs[index]] = [newTabs[index], newTabs[index - 1]];

    handleSettingChange('dataFileTabs', newTabs);
  };

  // タブを下に移動
  const handleMoveDown = (fileName: string) => {
    const tabs = editedSettings.dataFileTabs || [];
    const index = tabs.findIndex((tab) => tab.files.includes(fileName));

    if (index < 0 || index >= tabs.length - 1) return; // 最後の要素または見つからない場合は何もしない

    // 配列を入れ替え
    const newTabs = [...tabs];
    [newTabs[index], newTabs[index + 1]] = [newTabs[index + 1], newTabs[index]];

    handleSettingChange('dataFileTabs', newTabs);
  };

  // タブを上に移動（インデックスベース）
  const handleMoveTabUp = (tabIndex: number) => {
    const tabs = editedSettings.dataFileTabs || [];
    if (tabIndex <= 0) return;

    const newTabs = [...tabs];
    [newTabs[tabIndex - 1], newTabs[tabIndex]] = [newTabs[tabIndex], newTabs[tabIndex - 1]];

    handleSettingChange('dataFileTabs', newTabs);
  };

  // タブを下に移動（インデックスベース）
  const handleMoveTabDown = (tabIndex: number) => {
    const tabs = editedSettings.dataFileTabs || [];
    if (tabIndex < 0 || tabIndex >= tabs.length - 1) return;

    const newTabs = [...tabs];
    [newTabs[tabIndex], newTabs[tabIndex + 1]] = [newTabs[tabIndex + 1], newTabs[tabIndex]];

    handleSettingChange('dataFileTabs', newTabs);
  };

  // タブ名を変更（インデックスベース）
  const handleTabNameChangeByIndex = (tabIndex: number, tabName: string) => {
    const updatedTabs = [...(editedSettings.dataFileTabs || [])];
    if (tabIndex >= 0 && tabIndex < updatedTabs.length) {
      updatedTabs[tabIndex] = { ...updatedTabs[tabIndex], name: tabName };
      setEditedSettings((prev) => ({
        ...prev,
        dataFileTabs: updatedTabs,
      }));
    }
  };

  // タブを削除（インデックスベース）
  const handleDeleteTab = async (tabIndex: number) => {
    const tabs = editedSettings.dataFileTabs || [];
    if (tabIndex < 0 || tabIndex >= tabs.length) return;

    const tab = tabs[tabIndex];
    // data.txtを含むタブは削除不可
    if (tab.files.includes('data.txt')) {
      alert('data.txtを含むタブは削除できません。');
      return;
    }

    if (
      !confirm(
        `タブ「${tab.name}」を削除しますか？\nこのタブに含まれる全てのファイルも削除されます。`
      )
    ) {
      return;
    }

    try {
      // タブに含まれる全ファイルを削除
      for (const fileName of tab.files) {
        await window.electronAPI.deleteDataFile(fileName);
      }

      // タブを削除
      const updatedTabs = tabs.filter((_, index) => index !== tabIndex);
      await handleSettingChange('dataFileTabs', updatedTabs);
    } catch (error) {
      console.error('タブの削除に失敗しました:', error);
      alert('タブの削除に失敗しました。');
    }
  };

  // タブにファイルを追加
  const handleAddFileToTab = async (tabIndex: number, fileName: string) => {
    const tabs = editedSettings.dataFileTabs || [];
    if (tabIndex < 0 || tabIndex >= tabs.length) return;

    const tab = tabs[tabIndex];
    if (tab.files.includes(fileName)) {
      alert('このファイルは既にタブに含まれています。');
      return;
    }

    const updatedTabs = [...tabs];
    updatedTabs[tabIndex] = {
      ...tab,
      files: [...tab.files, fileName],
    };

    await handleSettingChange('dataFileTabs', updatedTabs);
  };

  // タブからファイルを削除
  const handleRemoveFileFromTab = async (tabIndex: number, fileName: string) => {
    const tabs = editedSettings.dataFileTabs || [];
    if (tabIndex < 0 || tabIndex >= tabs.length) return;

    const tab = tabs[tabIndex];

    // data.txtは削除不可
    if (fileName === 'data.txt') {
      alert('data.txtは削除できません。');
      return;
    }

    // タブに最低1つのファイルが必要
    if (tab.files.length === 1) {
      alert('タブには最低1つのファイルが必要です。タブごと削除してください。');
      return;
    }

    if (!confirm(`${fileName}をタブから削除しますか？\nファイル自体も削除されます。`)) {
      return;
    }

    try {
      // 物理ファイルを削除
      await window.electronAPI.deleteDataFile(fileName);

      // タブからファイルを削除
      const newFiles = tab.files.filter((f) => f !== fileName);
      const newDefaultFile = tab.defaultFile === fileName ? newFiles[0] : tab.defaultFile;

      const updatedTabs = [...tabs];
      updatedTabs[tabIndex] = {
        ...tab,
        files: newFiles,
        defaultFile: newDefaultFile,
      };

      await handleSettingChange('dataFileTabs', updatedTabs);
    } catch (error) {
      console.error('ファイルの削除に失敗しました:', error);
      alert('ファイルの削除に失敗しました。');
    }
  };

  // デフォルトファイルを設定
  const handleSetDefaultFile = async (tabIndex: number, fileName: string) => {
    const tabs = editedSettings.dataFileTabs || [];
    if (tabIndex < 0 || tabIndex >= tabs.length) return;

    const updatedTabs = [...tabs];
    updatedTabs[tabIndex] = {
      ...updatedTabs[tabIndex],
      defaultFile: fileName,
    };

    await handleSettingChange('dataFileTabs', updatedTabs);
  };

  // 新規ファイルを作成してタブに追加
  const handleCreateAndAddFileToTab = async (tabIndex: number) => {
    // 次のファイル名を自動決定
    const existingNumbers = dataFiles
      .map((file) => {
        if (file === 'data.txt') {
          return 1;
        }
        const match = file.match(/^data(\d+)\.txt$/i);
        return match ? parseInt(match[1]) : null;
      })
      .filter((n): n is number => n !== null);

    const nextNumber = existingNumbers.length > 0 ? Math.max(...existingNumbers) + 1 : 2;
    const fileName = `data${nextNumber}.txt`;

    try {
      // 物理ファイルを作成
      const result = await window.electronAPI.createDataFile(fileName);
      if (!result.success) {
        alert(result.error || 'ファイルの作成に失敗しました。');
        return;
      }

      // タブにファイルを追加
      await handleAddFileToTab(tabIndex, fileName);
    } catch (error) {
      console.error('ファイルの作成に失敗しました:', error);
      alert('ファイルの作成に失敗しました。');
    }
  };

  // 新規タブを追加
  const handleAddTab = async () => {
    // 新しいファイルを作成
    const existingNumbers = dataFiles
      .map((file) => {
        if (file === 'data.txt') {
          return 1;
        }
        const match = file.match(/^data(\d+)\.txt$/i);
        return match ? parseInt(match[1]) : null;
      })
      .filter((n): n is number => n !== null);

    const nextNumber = existingNumbers.length > 0 ? Math.max(...existingNumbers) + 1 : 2;
    const fileName = `data${nextNumber}.txt`;

    try {
      // 物理ファイルを作成
      const result = await window.electronAPI.createDataFile(fileName);
      if (!result.success) {
        alert(result.error || 'ファイルの作成に失敗しました。');
        return;
      }

      // 新しいタブを追加
      const newTab: DataFileTab = {
        files: [fileName],
        name: getDefaultTabName(fileName),
        defaultFile: fileName,
      };
      const updatedTabs = [...(editedSettings.dataFileTabs || []), newTab];

      await handleSettingChange('dataFileTabs', updatedTabs);
    } catch (error) {
      console.error('タブの追加に失敗しました:', error);
      alert('タブの追加に失敗しました。');
    }
  };

  // ファイル管理モーダルを開く
  const openFileModal = (tabIndex: number) => {
    setFileModalTabIndex(tabIndex);
  };

  // ファイル管理モーダルを閉じる
  const closeFileModal = () => {
    setFileModalTabIndex(null);
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
            <label htmlFor="windowPositionMode">表示位置:</label>
            <div className="radio-group">
              <label className="radio-label">
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
                画面中央
              </label>
              <label className="radio-label">
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
                マウスカーソルの位置
              </label>
              <label className="radio-label">
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
                固定位置（手動で移動した位置を記憶）
              </label>
            </div>
          </div>
          <div className="setting-description">
            ホットキーでウィンドウを表示する際の位置を設定します。
            <br />
            「固定位置」を選択した場合、ウィンドウを手動で移動すると、その位置が記憶されます。
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
                                  {fileName === tab.defaultFile && (
                                    <span className="default-badge-small">⭐ デフォルト</span>
                                  )}
                                </div>
                                <div className="file-actions">
                                  {fileName !== tab.defaultFile && (
                                    <button
                                      type="button"
                                      onClick={() => handleSetDefaultFile(fileModalTabIndex, fileName)}
                                      className="btn-secondary-small"
                                      disabled={isLoading}
                                    >
                                      デフォルトに設定
                                    </button>
                                  )}
                                  {tab.files.length > 1 && (
                                    <button
                                      type="button"
                                      onClick={() =>
                                        handleRemoveFileFromTab(fileModalTabIndex, fileName)
                                      }
                                      className="btn-danger-small"
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
                            <strong>デフォルトファイル:</strong>{' '}
                            新規アイテムを登録する際の保存先ファイルです。
                          </p>
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
    </div>
  );
};

export default SettingsTab;

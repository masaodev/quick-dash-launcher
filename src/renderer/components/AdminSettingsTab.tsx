import React, { useState, useEffect, useCallback } from 'react';
import {
  DEFAULT_DATA_FILE,
  AppSettings,
  WindowPositionMode,
  WorkspacePositionMode,
  DisplayInfo,
  BackupStatus,
} from '@common/types';

import { useDialogManager } from '../hooks/useDialogManager';
import { useSettingsManager } from '../hooks/useSettingsManager';
import { useTabManager } from '../hooks/tabManager';

import AlertDialog from './AlertDialog';
import ConfirmDialog from './ConfirmDialog';
import { HotkeyInput } from './HotkeyInput';
import { Button } from './ui';
import BookmarkAutoImportSettings from './BookmarkAutoImportSettings';
import BackupSnapshotModal from './BackupSnapshotModal';

interface SettingsTabProps {
  settings: AppSettings;
  onSave: (settings: AppSettings) => Promise<void>;
}

const AdminSettingsTab: React.FC<SettingsTabProps> = ({ settings, onSave }) => {
  const [editedSettings, setEditedSettings] = useState<AppSettings>(settings);
  const [selectedCategory, setSelectedCategory] = useState<string>('basic');
  const [displays, setDisplays] = useState<DisplayInfo[]>([]);
  const [backupStatus, setBackupStatus] = useState<BackupStatus | null>(null);
  const [showSnapshotModal, setShowSnapshotModal] = useState(false);

  // settingsプロパティが変更されたときにeditedSettingsを更新
  useEffect(() => {
    setEditedSettings(settings);
  }, [settings]);

  // ディスプレイ一覧を取得
  useEffect(() => {
    const loadDisplays = async () => {
      try {
        const displayInfos = await window.electronAPI.getDisplays();
        setDisplays(displayInfos);
      } catch (error) {
        console.error('ディスプレイ一覧の取得に失敗:', error);
      }
    };
    loadDisplays();
  }, []);

  // バックアップ状態を取得
  useEffect(() => {
    if (selectedCategory === 'backup') {
      const loadBackupStatus = async () => {
        try {
          const status = await window.electronAPI.backupAPI.getStatus();
          setBackupStatus(status);
        } catch (error) {
          console.error('バックアップ状態の取得に失敗:', error);
        }
      };
      loadBackupStatus();
    }
  }, [selectedCategory, showSnapshotModal]);

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

  // アイテム検索ホットキーのバリデーション状態
  const [itemSearchHotkeyValidation, setItemSearchHotkeyValidation] = useState<{
    isValid: boolean;
    reason?: string;
  }>({ isValid: true });

  // ウィンドウ検索の起動ホットキーの変更ハンドラー
  const handleItemSearchHotkeyChange = useCallback(
    async (newHotkey: string) => {
      try {
        const success = await window.electronAPI.changeItemSearchHotkey(newHotkey);
        if (success) {
          setEditedSettings((prev) => ({
            ...prev,
            itemSearchHotkey: newHotkey,
          }));
          toast.success('ウィンドウ検索の起動ホットキーを設定しました');
        } else {
          showAlert(
            'ウィンドウ検索の起動ホットキーの設定に失敗しました。ランチャー起動と同じ値は設定できません。',
            'error'
          );
        }
      } catch (error) {
        console.error('ウィンドウ検索の起動ホットキーの変更に失敗しました:', error);
        showAlert('ウィンドウ検索の起動ホットキーの変更に失敗しました。', 'error');
      }
    },
    [setEditedSettings, toast, showAlert]
  );

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
    showToast: toast.success,
  });

  // ディスプレイ端配置モードかどうか（後方互換性のためprimaryLeft/primaryRightも含む）
  const isDisplayEdgeMode =
    editedSettings.workspacePositionMode === 'displayLeft' ||
    editedSettings.workspacePositionMode === 'displayRight' ||
    editedSettings.workspacePositionMode === 'primaryLeft' ||
    editedSettings.workspacePositionMode === 'primaryRight';

  // 左端配置かどうか（後方互換性のためprimaryLeftも含む）
  const isLeftEdge =
    editedSettings.workspacePositionMode === 'displayLeft' ||
    editedSettings.workspacePositionMode === 'primaryLeft';

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
            {[
              { key: 'basic', label: '⚙️ 基本設定' },
              { key: 'window', label: '🪟 ウィンドウ' },
              { key: 'tabs', label: '📑 タブ管理' },
              { key: 'backup', label: '💾 バックアップ' },
              { key: 'bookmarkAutoImport', label: '🔖 ブックマーク自動取込' },
            ].map(({ key, label }) => (
              <button
                key={key}
                className={`menu-item ${selectedCategory === key ? 'active' : ''}`}
                onClick={() => handleCategoryChange(key)}
              >
                {label}
              </button>
            ))}
          </nav>
        </div>

        {/* 右側コンテンツ */}
        <div className="settings-content">
          {/* 基本設定 */}
          {selectedCategory === 'basic' && (
            <>
              <div className="settings-section">
                <h3>起動ホットキー</h3>
                <div className="setting-item">
                  <label htmlFor="hotkey">ランチャー起動:</label>
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
                <div className="setting-item">
                  <label htmlFor="itemSearchHotkey">ウィンドウ検索で起動:</label>
                  <HotkeyInput
                    value={editedSettings.itemSearchHotkey || ''}
                    onChange={handleItemSearchHotkeyChange}
                    onValidationChange={(isValid, reason) =>
                      setItemSearchHotkeyValidation({ isValid, reason })
                    }
                    disabled={isLoading}
                    placeholder="設定なし（オプション）"
                    allowEmpty={true}
                    showClearButton={true}
                  />
                  {!itemSearchHotkeyValidation.isValid && (
                    <div className="validation-error">{itemSearchHotkeyValidation.reason}</div>
                  )}
                  <div className="setting-description">
                    このホットキーでウィンドウ検索モードとして起動します。設定なしで無効化されます。
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
                  {[
                    {
                      title: 'メイン画面',
                      fields: [
                        {
                          id: 'windowWidth',
                          label: '幅',
                          min: 400,
                          max: 2000,
                          key: 'windowWidth' as const,
                        },
                        {
                          id: 'windowHeight',
                          label: '高さ',
                          min: 300,
                          max: 1200,
                          key: 'windowHeight' as const,
                        },
                      ],
                    },
                    {
                      title: '管理画面',
                      fields: [
                        {
                          id: 'editModeWidth',
                          label: '幅',
                          min: 800,
                          max: 2000,
                          key: 'editModeWidth' as const,
                        },
                        {
                          id: 'editModeHeight',
                          label: '高さ',
                          min: 600,
                          max: 1200,
                          key: 'editModeHeight' as const,
                        },
                      ],
                    },
                  ].map(({ title, fields }) => (
                    <div key={title} className="window-size-group">
                      <div className="window-size-group-title">{title}</div>
                      <div className="window-size-inputs">
                        {fields.map(({ id, label, min, max, key }) => (
                          <div key={id} className="window-size-field">
                            <label htmlFor={id}>{label}:</label>
                            <input
                              id={id}
                              type="number"
                              min={min}
                              max={max}
                              value={editedSettings[key]}
                              onChange={(e) => handleNumberInputChange(key, e.target.value)}
                              onBlur={handleNumberInputBlur}
                              disabled={isLoading}
                            />
                            <span className="unit">px</span>
                          </div>
                        ))}
                      </div>
                    </div>
                  ))}
                </div>
              </div>

              <div className="settings-section">
                <h3>ウィンドウ表示位置</h3>
                <div className="setting-item">
                  <div className="position-options">
                    {(
                      [
                        {
                          value: 'center',
                          title: '画面中央（固定）',
                          desc: '常にプライマリモニターの中央にウィンドウを表示します',
                        },
                        {
                          value: 'cursorMonitorCenter',
                          title: '画面中央（自動切替）',
                          desc: 'マウスカーソルがあるモニターの中央にウィンドウを表示します（マルチモニター推奨）',
                        },
                        {
                          value: 'cursor',
                          title: 'カーソル付近',
                          desc: 'マウスカーソルの近くにウィンドウを表示します（検索入力がしやすい位置）',
                        },
                        {
                          value: 'fixed',
                          title: '固定位置（手動設定）',
                          desc: 'ウィンドウを移動した位置を記憶して、次回も同じ位置に表示します',
                        },
                      ] as const
                    ).map(({ value, title, desc }) => (
                      <label key={value} className="position-option">
                        <input
                          type="radio"
                          name="windowPositionMode"
                          value={value}
                          checked={editedSettings.windowPositionMode === value}
                          onChange={(e) =>
                            handleSettingChange(
                              'windowPositionMode',
                              e.target.value as WindowPositionMode
                            )
                          }
                          disabled={isLoading}
                        />
                        <div className="option-content">
                          <div className="option-title">{title}</div>
                          <div className="option-description">{desc}</div>
                        </div>
                      </label>
                    ))}
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
                        value="displayEdge"
                        checked={isDisplayEdgeMode}
                        onChange={() =>
                          handleSettingChange('workspacePositionMode', 'displayRight')
                        }
                        disabled={isLoading}
                      />
                      <div className="option-content">
                        <div className="option-title">ディスプレイの端に配置（デフォルト）</div>
                        <div className="option-description">
                          選択したディスプレイの左端または右端にワークスペースを配置します
                        </div>
                        {isDisplayEdgeMode && (
                          <div className="display-edge-options">
                            <select
                              className="display-select"
                              value={editedSettings.workspaceTargetDisplayIndex}
                              onChange={(e) =>
                                handleSettingChange(
                                  'workspaceTargetDisplayIndex',
                                  parseInt(e.target.value)
                                )
                              }
                              disabled={isLoading}
                            >
                              {displays.map((display) => (
                                <option key={display.index} value={display.index}>
                                  {display.label}
                                </option>
                              ))}
                            </select>
                            <div className="edge-radio-group">
                              <label className="edge-option">
                                <input
                                  type="radio"
                                  name="displayEdgeSide"
                                  value="displayLeft"
                                  checked={isLeftEdge}
                                  onChange={() =>
                                    handleSettingChange('workspacePositionMode', 'displayLeft')
                                  }
                                  disabled={isLoading}
                                />
                                左端
                              </label>
                              <label className="edge-option">
                                <input
                                  type="radio"
                                  name="displayEdgeSide"
                                  value="displayRight"
                                  checked={!isLeftEdge}
                                  onChange={() =>
                                    handleSettingChange('workspacePositionMode', 'displayRight')
                                  }
                                  disabled={isLoading}
                                />
                                右端
                              </label>
                            </div>
                          </div>
                        )}
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

                <div className="setting-item">
                  <label>
                    <input
                      type="checkbox"
                      checked={editedSettings.workspaceVisibleOnAllDesktops}
                      onChange={(e) =>
                        handleSettingChange('workspaceVisibleOnAllDesktops', e.target.checked)
                      }
                      disabled={isLoading}
                    />
                    全ての仮想デスクトップに表示
                  </label>
                  <div className="setting-description">
                    有効にすると、ワークスペースウィンドウが全ての仮想デスクトップで表示されます（Windows
                    10/11の仮想デスクトップ機能）。
                  </div>
                </div>
              </div>
            </>
          )}

          {/* バックアップ */}
          {selectedCategory === 'backup' && (
            <div className="settings-section">
              <h3>バックアップ</h3>
              <p className="settings-section-description">
                アプリ起動時に1日1回、データファイル・設定ファイルをスナップショットとしてバックアップします。
              </p>
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
                    <label htmlFor="backupRetention">バックアップ保存件数:</label>
                    <input
                      id="backupRetention"
                      type="number"
                      min="3"
                      max="50"
                      value={editedSettings.backupRetention}
                      onChange={(e) => handleNumberInputChange('backupRetention', e.target.value)}
                      onBlur={handleNumberInputBlur}
                      disabled={isLoading}
                    />
                    <span className="unit">件</span>
                  </div>

                  <div className="setting-item indent">
                    <label>
                      <input
                        type="checkbox"
                        checked={editedSettings.backupIncludeClipboard}
                        onChange={(e) =>
                          handleSettingChange('backupIncludeClipboard', e.target.checked)
                        }
                        disabled={isLoading}
                      />
                      クリップボードデータもバックアップに含める
                    </label>
                    <div className="setting-description">
                      クリップボードデータは容量が大きくなる可能性があります。
                    </div>
                  </div>

                  {backupStatus && (
                    <div className="setting-item indent">
                      <div className="backup-status-info">
                        <span>スナップショット: {backupStatus.snapshotCount} 件</span>
                        <span>
                          最終バックアップ:{' '}
                          {backupStatus.lastBackupTime
                            ? new Date(backupStatus.lastBackupTime).toLocaleString('ja-JP')
                            : 'なし'}
                        </span>
                      </div>
                    </div>
                  )}

                  <div className="setting-item indent">
                    <Button
                      variant="info"
                      onClick={() => setShowSnapshotModal(true)}
                      disabled={isLoading}
                    >
                      スナップショット一覧
                    </Button>
                  </div>
                </>
              )}

              <BackupSnapshotModal
                isOpen={showSnapshotModal}
                onClose={() => setShowSnapshotModal(false)}
              />
            </div>
          )}

          {/* ブックマーク自動取込 */}
          {selectedCategory === 'bookmarkAutoImport' && (
            <div className="settings-section">
              <h3>ブックマーク自動取込</h3>
              <p className="settings-section-description">
                Chrome / Edge のブックマークを読み取り、ランチャーのアイテムとして自動取込します。
              </p>
              <BookmarkAutoImportSettings />
            </div>
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
                      const hasMainDataFile = tab.files.includes(DEFAULT_DATA_FILE);
                      const expanded = isTabExpanded(tabIndex);
                      const allDataFiles = Array.from(
                        new Set((editedSettings.dataFileTabs || []).flatMap((t) => t.files))
                      );
                      const availableFiles = allDataFiles.filter(
                        (file) => !tab.files.includes(file)
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
                                placeholder={getDefaultTabName(tab.files[0] || DEFAULT_DATA_FILE)}
                                disabled={isLoading}
                              />
                            ) : (
                              <span
                                className="tab-accordion-name"
                                onClick={() => toggleTabExpand(tabIndex)}
                              >
                                {tab.name || getDefaultTabName(tab.files[0] || DEFAULT_DATA_FILE)}
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
                                  const isMainDataFile = fileName === DEFAULT_DATA_FILE;
                                  const isLastFile = tab.files.length === 1;
                                  // data.jsonが他のタブにも存在するかチェック
                                  const mainDataFileExistsInOtherTabs =
                                    isMainDataFile &&
                                    (editedSettings.dataFileTabs || []).some(
                                      (t, idx) =>
                                        idx !== tabIndex && t.files.includes(DEFAULT_DATA_FILE)
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
                                            title="datafiles/data.jsonは最低1つのタブに必要です"
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

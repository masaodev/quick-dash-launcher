import React, { useState, useEffect, useCallback } from 'react';
import type { AppSettings } from '@common/types';

import { useDialogManager } from '../hooks/useDialogManager';
import { useSettingsManager } from '../hooks/useSettingsManager';
import { useTabManager } from '../hooks/tabManager';

import AlertDialog from './AlertDialog';
import ConfirmDialog from './ConfirmDialog';
import BookmarkAutoImportSettings from './BookmarkAutoImportSettings';
import AdminSettingsBasicSection from './AdminSettingsBasicSection';
import AdminSettingsWindowSection from './AdminSettingsWindowSection';
import AdminSettingsBackupSection from './AdminSettingsBackupSection';
import AdminSettingsTabsSection from './AdminSettingsTabsSection';

type SettingsCategory = 'basic' | 'window' | 'tabs' | 'backup' | 'bookmarkAutoImport';

const SETTINGS_CATEGORIES: Array<{ key: SettingsCategory; label: string }> = [
  { key: 'basic', label: '⚙️ 基本設定' },
  { key: 'window', label: '🪟 ウィンドウ' },
  { key: 'tabs', label: '📑 タブ管理' },
  { key: 'backup', label: '💾 バックアップ' },
  { key: 'bookmarkAutoImport', label: '🔖 ブックマーク自動取込' },
];

interface SettingsTabProps {
  settings: AppSettings;
  onSave: (settings: AppSettings) => Promise<void>;
}

const AdminSettingsTab: React.FC<SettingsTabProps> = ({ settings, onSave }) => {
  const [editedSettings, setEditedSettings] = useState<AppSettings>(settings);
  const [selectedCategory, setSelectedCategory] = useState<SettingsCategory>('basic');

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

  // カスタムフック: タブ管理（未保存の変更はカテゴリ切り替え時にも確認する）
  const tabManager = useTabManager({
    editedSettings,
    setEditedSettings,
    handleSettingChange,
    showAlert,
    showConfirm,
    showToast: toast.success,
  });

  const { hasUnsavedChanges: hasUnsavedTabChanges, handleCancelTabChanges } = tabManager;

  // カテゴリ切り替えハンドラ
  const handleCategoryChange = useCallback(
    async (newCategory: SettingsCategory) => {
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
            {SETTINGS_CATEGORIES.map(({ key, label }) => (
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
          {selectedCategory === 'basic' && (
            <AdminSettingsBasicSection
              editedSettings={editedSettings}
              isLoading={isLoading}
              handleSettingChange={handleSettingChange}
              hotkeyValidation={hotkeyValidation}
              onHotkeyValidation={handleHotkeyValidation}
              onItemSearchHotkeyChange={handleItemSearchHotkeyChange}
            />
          )}

          {selectedCategory === 'window' && (
            <AdminSettingsWindowSection
              editedSettings={editedSettings}
              isLoading={isLoading}
              handleSettingChange={handleSettingChange}
              handleNumberInputChange={handleNumberInputChange}
              handleNumberInputBlur={handleNumberInputBlur}
            />
          )}

          {selectedCategory === 'backup' && (
            <AdminSettingsBackupSection
              editedSettings={editedSettings}
              isLoading={isLoading}
              handleSettingChange={handleSettingChange}
              handleNumberInputChange={handleNumberInputChange}
              handleNumberInputBlur={handleNumberInputBlur}
            />
          )}

          {selectedCategory === 'bookmarkAutoImport' && (
            <div className="settings-section">
              <h3>ブックマーク自動取込</h3>
              <p className="settings-section-description">
                Chrome / Edge のブックマークを読み取り、ランチャーのアイテムとして自動取込します。
              </p>
              <BookmarkAutoImportSettings />
            </div>
          )}

          {selectedCategory === 'tabs' && (
            <AdminSettingsTabsSection
              editedSettings={editedSettings}
              isLoading={isLoading}
              handleSettingChange={handleSettingChange}
              tabManager={tabManager}
            />
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

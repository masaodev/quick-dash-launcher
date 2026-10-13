import React, { useState, useEffect, useCallback } from 'react';
import { useTranslation } from 'react-i18next';
import type { AppSettings } from '@common/types';

import { useDialogManager } from '../hooks/useDialogManager';
import { useSettingsManager } from '../hooks/useSettingsManager';
import { isResettableCategory, type SettingsCategory } from '../utils/settingsResetKeys';
import { logError } from '../utils/debug';

import AlertDialog from './AlertDialog';
import ConfirmDialog from './ConfirmDialog';
import BookmarkAutoImportSettings from './BookmarkAutoImportSettings';
import AdminSettingsBasicSection from './AdminSettingsBasicSection';
import AdminSettingsWindowSection from './AdminSettingsWindowSection';
import AdminSettingsBackupSection from './AdminSettingsBackupSection';
import AdminSettingsResetSection from './AdminSettingsResetSection';

const SETTINGS_CATEGORIES: readonly SettingsCategory[] = [
  'basic',
  'window',
  'backup',
  'bookmarkAutoImport',
];

interface SettingsTabProps {
  settings: AppSettings;
  onSave: (settings: AppSettings) => Promise<void>;
  /** 既定値に戻すなど、保存を経ずに設定が置き換わったとき親の状態も合わせる */
  onSettingsReplaced?: (settings: AppSettings) => void;
  /** 開いているカテゴリ（親が持つ。他のタブから「ブックマーク自動取込」を直接開くため） */
  selectedCategory: SettingsCategory;
  onSelectCategory: (category: SettingsCategory) => void;
  /** 「一度だけ取り込む」→ アイテム管理の手動取込モーダルを開く */
  onOpenManualBookmarkImport?: () => void;
}

const AdminSettingsTab: React.FC<SettingsTabProps> = ({
  settings,
  onSave,
  onSettingsReplaced,
  selectedCategory,
  onSelectCategory,
  onOpenManualBookmarkImport,
}) => {
  const { t } = useTranslation();
  const [editedSettings, setEditedSettings] = useState<AppSettings>(settings);

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
          toast.success(t('settings.hotkeys.windowSearchSaved'));
        } else {
          showAlert(t('settings.hotkeys.windowSearchSameAsLauncher'), 'error');
        }
      } catch (error) {
        logError('ウィンドウ検索の起動ホットキーの変更に失敗しました:', error);
        showAlert(t('settings.hotkeys.windowSearchChangeFailed'), 'error');
      }
    },
    [setEditedSettings, toast, showAlert, t]
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
    onSettingsReplaced,
    showAlert,
    showConfirm,
    showToast: toast.success,
  });

  return (
    <div className="settings-tab">
      {isLoading && <div className="loading-overlay">{t('settings.processing')}</div>}

      <div className="settings-with-sidebar">
        {/* 左側メニュー */}
        <div className="settings-sidebar">
          <nav className="settings-menu">
            {SETTINGS_CATEGORIES.map((key) => (
              <button
                key={key}
                className={`menu-item ${selectedCategory === key ? 'active' : ''}`}
                onClick={() => onSelectCategory(key)}
              >
                {t(`settings.categories.${key}`)}
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
              <h3>{t('settings.bookmarkAutoImport.heading')}</h3>
              <p className="settings-section-description">
                {t('settings.bookmarkAutoImport.description')}
              </p>
              <BookmarkAutoImportSettings onOpenManualImport={onOpenManualBookmarkImport} />
            </div>
          )}

          {isResettableCategory(selectedCategory) && (
            <AdminSettingsResetSection
              category={selectedCategory}
              isLoading={isLoading}
              onReset={handleReset}
            />
          )}
        </div>
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

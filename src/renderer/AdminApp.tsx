/**
 * 画面: 管理ウィンドウ
 * 画面仕様: docs/screens/admin-window.md
 */
import React, { useState, useEffect, useMemo, useRef } from 'react';
import { useTranslation } from 'react-i18next';
import type { AdminTab, AppSettings } from '@common/types';
import type { EditableJsonItem } from '@common/types/editableItem';
import { EXTERNAL_CHANGE_CONFLICT_MARKER } from '@common/types/editableItem';

import AdminTabContainer from './components/AdminTabContainer';
import AlertDialog from './components/AlertDialog';
import ConfirmDialog from './components/ConfirmDialog';
import { useAdminItemEditing, type AdminItemEditing } from './hooks/useAdminItemEditing';
import { useAlertDialog } from './hooks/useDialogManager';
import type { SettingsCategory } from './utils/settingsResetKeys';
import { debugInfo, logError } from './utils/debug';

const AdminApp: React.FC = () => {
  const { t } = useTranslation();
  const [activeTab, setActiveTab] = useState<AdminTab>('settings');
  const [editableItems, setEditableItems] = useState<EditableJsonItem[]>([]);
  // 楽観ロック用: 読み込み時（または保存後）のデータファイルのハッシュ。保存時に渡して外部変更との競合を検知する
  const [fileHashes, setFileHashes] = useState<Record<string, string> | undefined>(undefined);
  const [loadError, setLoadError] = useState<string | null>(null);

  // admin.html の <title> は日本語なので、表示言語のタイトルに差し替える（言語を変えたときも）
  useEffect(() => {
    document.title = t('admin.windowTitle');
  }, [t]);
  const [settings, setSettings] = useState<AppSettings | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [searchQuery, setSearchQuery] = useState('');
  const [pendingImportModal, setPendingImportModal] = useState<'bookmark' | 'app' | null>(null);
  // 設定タブで開いているカテゴリ。アイテム管理（手動取込）から「ブックマーク自動取込」を直接開けるよう、ここで持つ
  const [settingsCategory, setSettingsCategory] = useState<SettingsCategory>('basic');
  const { alertDialog, showAlert, closeAlert } = useAlertDialog();
  // × が押されたときの未保存確認
  const [closeConfirmOpen, setCloseConfirmOpen] = useState(false);
  // イベント購読は初回だけ登録するので、最新の編集状態は ref 経由で読む
  const editingRef = useRef<AdminItemEditing | null>(null);

  useEffect(() => {
    async function initialize(): Promise<void> {
      const [, initialTab, importModal] = await Promise.all([
        loadData(),
        window.electronAPI.getInitialTab().catch(() => 'settings' as const),
        window.electronAPI.getPendingImportModal().catch(() => null),
      ]);
      setActiveTab(initialTab);
      if (importModal) {
        setPendingImportModal(importModal);
      }
    }
    initialize();

    const unsubscribeSetActiveTab = window.electronAPI.onSetActiveTab(setActiveTab);
    const unsubscribeImportModal = window.electronAPI.onOpenImportModal((modal) => {
      setPendingImportModal(modal);
    });
    const unsubscribeData = window.electronAPI.onDataChanged(() => {
      debugInfo('データ変更通知を受信、データを再読み込みします');
      loadData(false);
    });
    const unsubscribeWindow = window.electronAPI.onWindowShown(() => {
      debugInfo('ウィンドウが表示されました、データを再読み込みします');
      loadData(false);
    });
    const unsubscribeClose = window.electronAPI.onAdminCloseRequested(() => {
      if (editingRef.current?.hasUnsavedChanges) {
        setCloseConfirmOpen(true);
      } else {
        window.electronAPI.hideEditWindow();
      }
    });

    return () => {
      unsubscribeSetActiveTab?.();
      unsubscribeImportModal?.();
      unsubscribeData?.();
      unsubscribeWindow?.();
      unsubscribeClose?.();
    };
  }, []);

  async function loadData(showLoading = true): Promise<void> {
    try {
      if (showLoading) setIsLoading(true);

      const [settingsData, itemsResult] = await Promise.all([
        window.electronAPI.getSettings(),
        window.electronAPI.loadEditableItems(),
      ]);

      setSettings(settingsData);
      if (itemsResult.error) {
        logError('Failed to load editable items:', itemsResult.error);
        setLoadError(itemsResult.error);
        setEditableItems([]);
        setFileHashes(undefined);
      } else {
        setLoadError(null);
        setEditableItems(itemsResult.items);
        setFileHashes(itemsResult.fileHashes);
      }
    } catch (error) {
      logError('Failed to load data:', error);
      setLoadError(String(error));
    } finally {
      if (showLoading) setIsLoading(false);
    }
  }

  /**
   * アイテム管理の変更を保存する
   *
   * @returns 保存できたら true。競合・失敗のときは false（編集状態は呼び出し側で保持する）
   */
  async function handleEditableItemsSave(newEditableItems: EditableJsonItem[]): Promise<boolean> {
    if (!fileHashes) {
      // 読み込みに失敗した状態で全件を書くと、読めなかったファイルを空で上書きしてしまう
      showAlert(t('admin.saveBlockedByLoadError'), 'error');
      return false;
    }

    try {
      const result = await window.electronAPI.saveEditableItems(newEditableItems, fileHashes);
      setFileHashes(result.fileHashes);
      setEditableItems(newEditableItems);
      debugInfo('Editable items saved successfully', result.writtenFiles);
      return true;
    } catch (error) {
      logError('Failed to save editable items:', error);
      const message = error instanceof Error ? error.message : String(error);
      if (message.includes(EXTERNAL_CHANGE_CONFLICT_MARKER)) {
        // 読み込み後に外部（または他の画面）で変更されている。上書きせず最新を読み直す。
        // 未保存の編集は useAdminItemEditing が新しい内容の上に載せ直す
        showAlert(t('admin.externalChangeConflict'), 'warning');
        await loadData(false);
        return false;
      }
      showAlert(t('admin.itemSaveFailed', { error: message }), 'error');
      return false;
    }
  }

  // 編集状態はタブを切り替えても消えないよう、画面ではなくここで持つ
  const editing = useAdminItemEditing(editableItems, handleEditableItemsSave);
  editingRef.current = editing;

  async function handleSettingsSave(newSettings: AppSettings): Promise<void> {
    try {
      const isHotkeyChanged = settings && settings.hotkey !== newSettings.hotkey;
      await window.electronAPI.setMultipleSettings(newSettings);

      if (isHotkeyChanged) {
        const success = await window.electronAPI.changeHotkey(newSettings.hotkey);
        if (!success) {
          logError('Failed to register new hotkey:', newSettings.hotkey);
          showAlert(t('admin.hotkeyRegisterFailed', { hotkey: newSettings.hotkey }), 'error');
          return;
        }
        debugInfo(`Hotkey changed successfully to: ${newSettings.hotkey}`);
      }

      setSettings(newSettings);
      debugInfo('Settings saved successfully');
    } catch (error) {
      logError('Failed to save settings:', error);
      showAlert(t('admin.settingsSaveFailed'), 'error');
    }
  }

  /** 設定タブの指定カテゴリを開く（手動取込モーダル → 自動取込の設定、など） */
  function openSettingsCategory(category: SettingsCategory): void {
    setSettingsCategory(category);
    setActiveTab('settings');
  }

  /** アイテム管理タブで手動のブックマーク取込モーダルを開く（自動取込の設定 → 一度だけ取り込む、など） */
  function openManualBookmarkImport(): void {
    setPendingImportModal('bookmark');
    setActiveTab('edit');
  }

  const dataFileTabs = useMemo(() => settings?.dataFileTabs ?? [], [settings?.dataFileTabs]);
  const dataFileLabels = useMemo(() => settings?.dataFileLabels ?? {}, [settings?.dataFileLabels]);

  if (isLoading) {
    return (
      <div className="loading-container">
        <div className="loading-message">{t('admin.loading')}</div>
      </div>
    );
  }

  return (
    <div className="admin-app">
      <AdminTabContainer
        activeTab={activeTab}
        onTabChange={setActiveTab}
        settings={settings}
        onSettingsSave={handleSettingsSave}
        onSettingsReplaced={setSettings}
        onTabStructureSaved={(changed) =>
          setSettings((prev) => (prev ? { ...prev, ...changed } : prev))
        }
        editing={editing}
        loadError={loadError}
        searchQuery={searchQuery}
        onSearchChange={setSearchQuery}
        dataFileTabs={dataFileTabs}
        dataFileLabels={dataFileLabels}
        pendingImportModal={pendingImportModal}
        onClearPendingImportModal={() => setPendingImportModal(null)}
        settingsCategory={settingsCategory}
        onSettingsCategoryChange={setSettingsCategory}
        onOpenSettingsCategory={openSettingsCategory}
        onOpenManualBookmarkImport={openManualBookmarkImport}
      />

      <AlertDialog
        isOpen={alertDialog.isOpen}
        onClose={closeAlert}
        message={alertDialog.message}
        type={alertDialog.type}
      />

      <ConfirmDialog
        isOpen={closeConfirmOpen}
        onClose={() => setCloseConfirmOpen(false)}
        onConfirm={() => {
          setCloseConfirmOpen(false);
          editing.discardChanges();
          window.electronAPI.hideEditWindow();
        }}
        message={t('admin.unsavedCloseConfirm')}
        confirmText={t('admin.discardAndClose')}
        danger
      />
    </div>
  );
};

export default AdminApp;

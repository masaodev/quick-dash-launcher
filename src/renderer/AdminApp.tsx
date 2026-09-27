import React, { useState, useEffect, useMemo, useRef } from 'react';
import type { AppSettings } from '@common/types';
import type { EditableJsonItem } from '@common/types/editableItem';
import { EXTERNAL_CHANGE_CONFLICT_MARKER } from '@common/types/editableItem';

import AdminTabContainer from './components/AdminTabContainer';
import AlertDialog from './components/AlertDialog';
import ConfirmDialog from './components/ConfirmDialog';
import { useAdminItemEditing, type AdminItemEditing } from './hooks/useAdminItemEditing';
import type { SettingsCategory } from './utils/settingsResetKeys';
import { debugInfo, logError } from './utils/debug';

type AlertDialogState = {
  isOpen: boolean;
  message: string;
  type: 'info' | 'error' | 'warning' | 'success';
};

const AdminApp: React.FC = () => {
  const [activeTab, setActiveTab] = useState<'settings' | 'edit' | 'other'>('settings');
  const [editableItems, setEditableItems] = useState<EditableJsonItem[]>([]);
  // 楽観ロック用: 読み込み時（または保存後）のデータファイルのハッシュ。保存時に渡して外部変更との競合を検知する
  const [fileHashes, setFileHashes] = useState<Record<string, string> | undefined>(undefined);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [settings, setSettings] = useState<AppSettings | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [searchQuery, setSearchQuery] = useState('');
  const [pendingImportModal, setPendingImportModal] = useState<'bookmark' | 'app' | null>(null);
  // 設定タブで開いているカテゴリ。アイテム管理（手動取込）から「ブックマーク自動取込」を直接開けるよう、ここで持つ
  const [settingsCategory, setSettingsCategory] = useState<SettingsCategory>('basic');
  const [alertDialog, setAlertDialog] = useState<AlertDialogState>({
    isOpen: false,
    message: '',
    type: 'info',
  });
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
      setAlertDialog({
        isOpen: true,
        message:
          'データファイルの読み込みに失敗しているため保存できません。' +
          'ファイルを修復してから、ウィンドウを開き直してください。',
        type: 'error',
      });
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
        setAlertDialog({
          isOpen: true,
          message:
            'データファイルが QDL の外で変更されていた（または他の画面で編集された）ため、' +
            '今回の保存は行っていません。最新の内容を読み込み直し、未保存の編集は載せ直しました。' +
            '内容を確認して、もう一度保存してください。',
          type: 'warning',
        });
        await loadData(false);
        return false;
      }
      setAlertDialog({
        isOpen: true,
        message: `アイテムの保存に失敗しました。${message}`,
        type: 'error',
      });
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
          setAlertDialog({
            isOpen: true,
            message: `新しいホットキー「${newSettings.hotkey}」の登録に失敗しました。他のアプリで使用されている可能性があります。`,
            type: 'error',
          });
          return;
        }
        debugInfo(`Hotkey changed successfully to: ${newSettings.hotkey}`);
      }

      setSettings(newSettings);
      debugInfo('Settings saved successfully');
    } catch (error) {
      logError('Failed to save settings:', error);
      setAlertDialog({
        isOpen: true,
        message: '設定の保存に失敗しました。',
        type: 'error',
      });
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
        <div className="loading-message">データを読み込み中...</div>
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
        onClose={() => setAlertDialog({ ...alertDialog, isOpen: false })}
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
        message={
          'アイテム管理に未保存の変更があります。変更を破棄してウィンドウを閉じますか？' +
          '\n\n保存する場合はキャンセルして「変更を保存」を押してください。'
        }
        confirmText="破棄して閉じる"
        danger
      />
    </div>
  );
};

export default AdminApp;

import React, { useState, useEffect, useMemo } from 'react';
import type { AppSettings } from '@common/types';
import type { EditableJsonItem } from '@common/types/editableItem';
import { EXTERNAL_CHANGE_CONFLICT_MARKER } from '@common/types/editableItem';

import AdminTabContainer from './components/AdminTabContainer';
import AlertDialog from './components/AlertDialog';
import { debugInfo, logError } from './utils/debug';

type AlertDialogState = {
  isOpen: boolean;
  message: string;
  type: 'info' | 'error' | 'warning' | 'success';
};

const AdminApp: React.FC = () => {
  const [activeTab, setActiveTab] = useState<'settings' | 'edit' | 'other'>('settings');
  const [editableItems, setEditableItems] = useState<EditableJsonItem[]>([]);
  // 楽観ロック用: 読み込み時のデータファイルのハッシュ。保存時に渡して外部変更との競合を検知する
  const [fileHashes, setFileHashes] = useState<Record<string, string> | undefined>(undefined);
  const [settings, setSettings] = useState<AppSettings | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [searchQuery, setSearchQuery] = useState('');
  const [pendingImportModal, setPendingImportModal] = useState<'bookmark' | 'app' | null>(null);
  const [alertDialog, setAlertDialog] = useState<AlertDialogState>({
    isOpen: false,
    message: '',
    type: 'info',
  });

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

    return () => {
      unsubscribeSetActiveTab?.();
      unsubscribeImportModal?.();
      unsubscribeData?.();
      unsubscribeWindow?.();
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
        setEditableItems([]);
        setFileHashes(undefined);
      } else {
        setEditableItems(itemsResult.items);
        setFileHashes(itemsResult.fileHashes);
      }
    } catch (error) {
      logError('Failed to load data:', error);
    } finally {
      if (showLoading) setIsLoading(false);
    }
  }

  async function handleEditableItemsSave(newEditableItems: EditableJsonItem[]): Promise<void> {
    try {
      await window.electronAPI.saveEditableItems(newEditableItems, fileHashes);
      setEditableItems(newEditableItems);
      debugInfo('Editable items saved successfully');
    } catch (error) {
      logError('Failed to save editable items:', error);
      const message = error instanceof Error ? error.message : String(error);
      if (message.includes(EXTERNAL_CHANGE_CONFLICT_MARKER)) {
        // 読み込み後に QDL 外で変更されている。上書きせず、最新の内容を読み直す
        setAlertDialog({
          isOpen: true,
          message:
            'データファイルが QDL の外で変更されていたため、今回の編集は保存していません。' +
            '最新の内容を読み込み直しますので、もう一度編集してください。',
          type: 'warning',
        });
        await loadData(false);
        return;
      }
      setAlertDialog({
        isOpen: true,
        message: `アイテムの保存に失敗しました。${message}`,
        type: 'error',
      });
    }
  }

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
        editableItems={editableItems}
        onEditableItemsSave={handleEditableItemsSave}
        searchQuery={searchQuery}
        onSearchChange={setSearchQuery}
        dataFileTabs={dataFileTabs}
        dataFileLabels={dataFileLabels}
        pendingImportModal={pendingImportModal}
        onClearPendingImportModal={() => setPendingImportModal(null)}
      />

      <AlertDialog
        isOpen={alertDialog.isOpen}
        onClose={() => setAlertDialog({ ...alertDialog, isOpen: false })}
        message={alertDialog.message}
        type={alertDialog.type}
      />
    </div>
  );
};

export default AdminApp;

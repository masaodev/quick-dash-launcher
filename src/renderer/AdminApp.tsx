import React, { useState, useEffect, useMemo } from 'react';
import type { AppSettings } from '@common/types';
import type { EditableJsonItem } from '@common/types/editableItem';
import { EXTERNAL_CHANGE_CONFLICT_MARKER } from '@common/types/editableItem';

import AdminTabContainer from './components/AdminTabContainer';
import AlertDialog from './components/AlertDialog';
import { useAdminItemEditing } from './hooks/useAdminItemEditing';
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
        editing={editing}
        loadError={loadError}
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

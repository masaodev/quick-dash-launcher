import { useState, useCallback, Dispatch, SetStateAction } from 'react';
import { AppSettings } from '@common/types';

import { logError } from '../utils/debug';

interface UseSettingsManagerProps {
  settings: AppSettings;
  editedSettings: AppSettings;
  setEditedSettings: Dispatch<SetStateAction<AppSettings>>;
  onSave: (settings: AppSettings) => Promise<void>;
  showAlert: (message: string, type?: 'info' | 'error' | 'warning' | 'success') => void;
  showToast?: (message: string) => void;
}

export function useSettingsManager({
  editedSettings,
  setEditedSettings,
  onSave,
  showAlert,
  showToast,
}: UseSettingsManagerProps) {
  const [hotkeyValidation, setHotkeyValidation] = useState<{ isValid: boolean; reason?: string }>({
    isValid: true,
  });
  const [isLoading, setIsLoading] = useState(false);

  // 設定項目の変更ハンドラ（即座に保存）
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
        // 成功時にトースト表示
        showToast?.('設定を保存しました');
      } catch (error) {
        logError('設定の保存に失敗しました:', error);
        showAlert('設定の保存に失敗しました。', 'error');
      }
    },
    [editedSettings, onSave, setEditedSettings, showAlert, showToast]
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
    [setEditedSettings]
  );

  // 数値入力のフォーカス喪失ハンドラ（保存処理）
  const handleNumberInputBlur = useCallback(async () => {
    try {
      await onSave(editedSettings);
      // 成功時にトースト表示
      showToast?.('設定を保存しました');
    } catch (error) {
      logError('設定の保存に失敗しました:', error);
      showAlert('設定の保存に失敗しました。', 'error');
    }
  }, [editedSettings, onSave, showAlert, showToast]);

  // ホットキーバリデーション結果の処理
  const handleHotkeyValidation = useCallback((isValid: boolean, reason?: string) => {
    setHotkeyValidation({ isValid, reason });
  }, []);

  // 設定リセット
  const handleReset = useCallback(async () => {
    if (!confirm('設定をデフォルト値にリセットしますか？')) {
      return;
    }

    try {
      setIsLoading(true);
      await window.electronAPI.resetSettings();
      const resetSettings = await window.electronAPI.getSettings();
      setEditedSettings(resetSettings);
    } catch (error) {
      logError('設定のリセットに失敗しました:', error);
      showAlert('設定のリセットに失敗しました。', 'error');
    } finally {
      setIsLoading(false);
    }
  }, [setEditedSettings, showAlert]);

  // 設定フォルダを開く
  const handleOpenConfigFolder = useCallback(async () => {
    try {
      await window.electronAPI.openConfigFolder();
    } catch (error) {
      logError('設定フォルダを開くのに失敗しました:', error);
      showAlert('設定フォルダを開くのに失敗しました。', 'error');
    }
  }, [showAlert]);

  return {
    hotkeyValidation,
    isLoading,
    handleSettingChange,
    handleNumberInputChange,
    handleNumberInputBlur,
    handleHotkeyValidation,
    handleReset,
    handleOpenConfigFolder,
  };
}

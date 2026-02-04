import { useState, useCallback, Dispatch, SetStateAction } from 'react';
import { AppSettings } from '@common/types';

import { logError } from '../utils/debug';

interface UseSettingsManagerProps {
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

  const saveSettings = useCallback(
    async (settings: AppSettings, successMessage: string): Promise<void> => {
      try {
        await onSave(settings);
        showToast?.(successMessage);
      } catch (error) {
        logError('設定の保存に失敗しました:', error);
        showAlert('設定の保存に失敗しました。', 'error');
      }
    },
    [onSave, showAlert, showToast]
  );

  const handleSettingChange = useCallback(
    async <K extends keyof AppSettings>(key: K, value: AppSettings[K]): Promise<void> => {
      const newSettings = { ...editedSettings, [key]: value };
      setEditedSettings(newSettings);
      await saveSettings(newSettings, '設定を保存しました');
    },
    [editedSettings, setEditedSettings, saveSettings]
  );

  const handleNumberInputChange = useCallback(
    <K extends keyof AppSettings>(key: K, value: string): void => {
      const numValue = parseInt(value);
      if (!isNaN(numValue)) {
        setEditedSettings((prev) => ({ ...prev, [key]: numValue }));
      }
    },
    [setEditedSettings]
  );

  const handleNumberInputBlur = useCallback(async (): Promise<void> => {
    await saveSettings(editedSettings, '設定を保存しました');
  }, [editedSettings, saveSettings]);

  const handleHotkeyValidation = useCallback((isValid: boolean, reason?: string): void => {
    setHotkeyValidation({ isValid, reason });
  }, []);

  const handleReset = useCallback(async (): Promise<void> => {
    if (!confirm('設定をデフォルト値にリセットしますか？')) {
      return;
    }

    try {
      setIsLoading(true);
      await window.electronAPI.resetSettings();
      const resetSettings = await window.electronAPI.getSettings();
      setEditedSettings(resetSettings);
      showToast?.('設定をリセットしました');
    } catch (error) {
      logError('設定のリセットに失敗しました:', error);
      showAlert('設定のリセットに失敗しました。', 'error');
    } finally {
      setIsLoading(false);
    }
  }, [setEditedSettings, showAlert, showToast]);

  const handleOpenConfigFolder = useCallback(async (): Promise<void> => {
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

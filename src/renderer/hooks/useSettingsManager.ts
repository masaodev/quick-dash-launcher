import { useState, useCallback, Dispatch, SetStateAction } from 'react';
import { AppSettings } from '@common/types';

import { logError } from '../utils/debug';
import {
  SETTINGS_RESET_KEYS,
  SETTINGS_RESET_LABELS,
  SETTINGS_RESET_NOTES,
  type ResettableSettingsCategory,
} from '../utils/settingsResetKeys';

export type HandleSettingChange = <K extends keyof AppSettings>(
  key: K,
  value: AppSettings[K],
  options?: { silent?: boolean }
) => Promise<void>;

interface UseSettingsManagerProps {
  editedSettings: AppSettings;
  setEditedSettings: Dispatch<SetStateAction<AppSettings>>;
  onSave: (settings: AppSettings) => Promise<void>;
  /** 既定値に戻した後の設定を親（AdminApp）にも反映する。渡さないと親の状態が古いまま残る */
  onSettingsReplaced?: (settings: AppSettings) => void;
  showAlert: (message: string, type?: 'info' | 'error' | 'warning' | 'success') => void;
  showConfirm: (
    message: string,
    options?: { title?: string; confirmText?: string; cancelText?: string; danger?: boolean }
  ) => Promise<boolean>;
  showToast?: (message: string) => void;
}

export function useSettingsManager({
  editedSettings,
  setEditedSettings,
  onSave,
  onSettingsReplaced,
  showAlert,
  showConfirm,
  showToast,
}: UseSettingsManagerProps) {
  const [hotkeyValidation, setHotkeyValidation] = useState<{ isValid: boolean; reason?: string }>({
    isValid: true,
  });
  const [isLoading, setIsLoading] = useState(false);

  const saveSettings = useCallback(
    async (settings: AppSettings, successMessage?: string): Promise<void> => {
      try {
        await onSave(settings);
        if (successMessage) {
          showToast?.(successMessage);
        }
      } catch (error) {
        logError('設定の保存に失敗しました:', error);
        showAlert('設定の保存に失敗しました。', 'error');
      }
    },
    [onSave, showAlert, showToast]
  );

  const handleSettingChange = useCallback(
    async <K extends keyof AppSettings>(
      key: K,
      value: AppSettings[K],
      options?: { silent?: boolean }
    ): Promise<void> => {
      const newSettings = { ...editedSettings, [key]: value };
      setEditedSettings(newSettings);
      await saveSettings(newSettings, options?.silent ? undefined : '設定を保存しました');
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

  /**
   * カテゴリ単位で設定を既定値に戻す
   *
   * @param category 戻すカテゴリ（戻す項目は SETTINGS_RESET_KEYS）
   */
  const handleReset = useCallback(
    async (category: ResettableSettingsCategory): Promise<void> => {
      const label = SETTINGS_RESET_LABELS[category];
      const note = SETTINGS_RESET_NOTES[category];
      const confirmed = await showConfirm(
        `「${label}」の項目を既定値に戻しますか？${note ? `\n${note}` : ''}`,
        {
          title: '既定値に戻す',
          confirmText: '既定値に戻す',
          cancelText: 'キャンセル',
          danger: true,
        }
      );
      if (!confirmed) return;

      try {
        setIsLoading(true);
        const resetSettings = await window.electronAPI.resetSettings([
          ...SETTINGS_RESET_KEYS[category],
        ]);
        setEditedSettings(resetSettings);
        onSettingsReplaced?.(resetSettings);
        showToast?.(`「${label}」を既定値に戻しました`);
      } catch (error) {
        logError('設定のリセットに失敗しました:', error);
        showAlert('設定のリセットに失敗しました。', 'error');
      } finally {
        setIsLoading(false);
      }
    },
    [setEditedSettings, onSettingsReplaced, showAlert, showConfirm, showToast]
  );

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

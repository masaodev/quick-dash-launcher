import { useState, useCallback, Dispatch, SetStateAction } from 'react';
import { useTranslation } from 'react-i18next';
import { AppSettings } from '@common/types';
import { clampSettingNumbers } from '@common/settingRanges';

import { logError } from '../utils/debug';
import {
  SETTINGS_RESET_KEYS,
  getResetSectionText,
  getSectionResetChanges,
  type ResettableSettingsSection,
} from '../utils/settingsResetKeys';

import type { ConfirmOptions } from './useDialogManager';

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
  showConfirm: (message: string, options?: ConfirmOptions) => Promise<boolean>;
  showToast?: (message: string) => void;
  /** 設定の既定値（読み込むまでは null。既定値に戻すときに何が変わるかを出すのに使う） */
  defaultSettings?: AppSettings | null;
}

export function useSettingsManager({
  editedSettings,
  setEditedSettings,
  onSave,
  onSettingsReplaced,
  showAlert,
  showConfirm,
  showToast,
  defaultSettings = null,
}: UseSettingsManagerProps) {
  const { t, i18n } = useTranslation();
  const [hotkeyValidation, setHotkeyValidation] = useState<{ isValid: boolean; reason?: string }>({
    isValid: true,
  });
  const [isLoading, setIsLoading] = useState(false);

  const saveSettings = useCallback(
    async (settings: AppSettings, successMessage?: string): Promise<boolean> => {
      try {
        await onSave(settings);
        if (successMessage) {
          showToast?.(successMessage);
        }
        return true;
      } catch (error) {
        logError('設定の保存に失敗しました:', error);
        showAlert(t('settings.saveFailed'), 'error');
        return false;
      }
    },
    [onSave, showAlert, showToast, t]
  );

  const handleSettingChange = useCallback(
    async <K extends keyof AppSettings>(
      key: K,
      value: AppSettings[K],
      options?: { silent?: boolean }
    ): Promise<void> => {
      const newSettings = { ...editedSettings, [key]: value };
      setEditedSettings(newSettings);
      if (key === 'language' && !options?.silent) {
        // 保存の知らせは切り替えた後の言語で出す（今の t で作ると前の言語のまま出る）
        if (!(await saveSettings(newSettings))) return;
        const language = await window.electronAPI.getLanguage().catch(() => null);
        showToast?.(language ? i18n.getFixedT(language)('settings.saved') : t('settings.saved'));
        return;
      }
      await saveSettings(newSettings, options?.silent ? undefined : t('settings.saved'));
    },
    [editedSettings, setEditedSettings, saveSettings, showToast, i18n, t]
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

  // 範囲の外の値は、保存する前に範囲の端へ寄せる（CLI と同じ範囲。欄の表示も合わせる）
  const handleNumberInputBlur = useCallback(async (): Promise<void> => {
    const clamped = clampSettingNumbers(editedSettings);
    if (clamped !== editedSettings) setEditedSettings(clamped);
    await saveSettings(clamped, t('settings.saved'));
  }, [editedSettings, setEditedSettings, saveSettings, t]);

  const handleHotkeyValidation = useCallback((isValid: boolean, reason?: string): void => {
    setHotkeyValidation({ isValid, reason });
  }, []);

  /**
   * 枠単位で設定を既定値に戻す。確認ダイアログに、何がどう変わるかを表で出す
   *
   * @param section 戻す枠（戻す項目は SETTINGS_RESET_KEYS）
   */
  const handleReset = useCallback(
    async (section: ResettableSettingsSection): Promise<void> => {
      if (!defaultSettings) return;
      const { label, note } = getResetSectionText(t, section);
      const { changes, forgetsSavedPosition } = getSectionResetChanges(
        t,
        section,
        editedSettings,
        defaultSettings
      );
      const message = [
        t('settings.reset.confirm'),
        forgetsSavedPosition ? t('settings.reset.notes.savedPosition') : '',
        note,
      ]
        .filter(Boolean)
        .join('\n');
      const confirmed = await showConfirm(message, {
        title: t('settings.reset.title', { section: label }),
        confirmText: t('settings.reset.confirmButton'),
        cancelText: t('common.cancel'),
        details: changes,
      });
      if (!confirmed) return;

      try {
        setIsLoading(true);
        const resetSettings = await window.electronAPI.resetSettings([
          ...SETTINGS_RESET_KEYS[section],
        ]);
        setEditedSettings(resetSettings);
        onSettingsReplaced?.(resetSettings);
        showToast?.(t('settings.reset.done', { section: label }));
      } catch (error) {
        logError('設定のリセットに失敗しました:', error);
        showAlert(t('settings.reset.failed'), 'error');
      } finally {
        setIsLoading(false);
      }
    },
    [
      defaultSettings,
      editedSettings,
      setEditedSettings,
      onSettingsReplaced,
      showAlert,
      showConfirm,
      showToast,
      t,
    ]
  );

  const handleOpenConfigFolder = useCallback(async (): Promise<void> => {
    try {
      await window.electronAPI.openConfigFolder();
    } catch (error) {
      logError('設定フォルダを開くのに失敗しました:', error);
      showAlert(t('settings.openSettingsFolderFailed'), 'error');
    }
  }, [showAlert, t]);

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

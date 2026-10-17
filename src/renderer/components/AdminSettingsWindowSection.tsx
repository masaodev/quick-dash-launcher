import React, { useEffect, useState } from 'react';
import { useTranslation } from 'react-i18next';
import type { AppSettings, DisplayInfo } from '@common/types';

import type { HandleSettingChange } from '../hooks/useSettingsManager';
import { logError } from '../utils/debug';

import AdminSettingsWindowMain from './AdminSettingsWindowMain';
import AdminSettingsWindowWorkspace from './AdminSettingsWindowWorkspace';
import AdminSettingsWindowDetached from './AdminSettingsWindowDetached';
import AdminSettingsWindowDetails from './AdminSettingsWindowDetails';

interface AdminSettingsWindowSectionProps {
  editedSettings: AppSettings;
  isLoading: boolean;
  handleSettingChange: HandleSettingChange;
  handleNumberInputChange: <K extends keyof AppSettings>(key: K, value: string) => void;
  handleNumberInputBlur: () => Promise<void>;
}

/**
 * 設定画面「ウィンドウ」: メインウィンドウ・ワークスペースウィンドウ・切り離しウィンドウの表示する場所と、
 * 畳んだ「詳しい設定」（大きさ・見た目・仮想デスクトップ・吸着）
 * 隠れるか残るかは設定ではなく、各ウィンドウの 📌 で決める
 */
const AdminSettingsWindowSection: React.FC<AdminSettingsWindowSectionProps> = ({
  editedSettings,
  isLoading,
  handleSettingChange,
  handleNumberInputChange,
  handleNumberInputBlur,
}) => {
  const { t } = useTranslation();
  const [displays, setDisplays] = useState<DisplayInfo[]>([]);

  // ディスプレイ一覧を取得（ワークスペースの配置先の選択肢）
  useEffect(() => {
    const loadDisplays = async () => {
      try {
        setDisplays(await window.electronAPI.getDisplays());
      } catch (error) {
        logError('ディスプレイ一覧の取得に失敗:', error);
      }
    };
    loadDisplays();
  }, []);

  const common = { editedSettings, isLoading, handleSettingChange };

  return (
    <>
      <AdminSettingsWindowMain {...common} />
      <AdminSettingsWindowWorkspace {...common} displays={displays} />
      <AdminSettingsWindowDetached {...common} />
      <p className="settings-note">{t('settings.windowNote')}</p>
      <AdminSettingsWindowDetails
        {...common}
        handleNumberInputChange={handleNumberInputChange}
        handleNumberInputBlur={handleNumberInputBlur}
      />
    </>
  );
};

export default AdminSettingsWindowSection;

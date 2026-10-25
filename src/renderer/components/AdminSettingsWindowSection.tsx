import React, { useEffect, useState } from 'react';
import type { AppSettings, DisplayInfo } from '@common/types';

import type { HandleSettingChange } from '../hooks/useSettingsManager';
import { logError } from '../utils/debug';

import AdminSettingsWindowMain from './AdminSettingsWindowMain';
import AdminSettingsWindowWorkspace from './AdminSettingsWindowWorkspace';
import AdminSettingsWindowDetached from './AdminSettingsWindowDetached';
import AdminSettingsWindowOther from './AdminSettingsWindowOther';
import type { SectionResetProps } from './SettingsSectionHeader';

interface AdminSettingsWindowSectionProps {
  editedSettings: AppSettings;
  isLoading: boolean;
  handleSettingChange: HandleSettingChange;
  handleNumberInputChange: <K extends keyof AppSettings>(key: K, value: string) => void;
  handleNumberInputBlur: () => Promise<void>;
  sectionReset: SectionResetProps;
}

/**
 * 設定画面「ウィンドウ」: ウィンドウごとの節（メイン・ワークスペース・切り離し）と、2 つ以上に効く「その他」
 * どの節も「項目名: 入力欄 説明」の並びで、取込ルールの画面と同じ形
 * 隠れるか残るかは設定ではなく、各ウィンドウの 📌 で決める
 */
const AdminSettingsWindowSection: React.FC<AdminSettingsWindowSectionProps> = ({
  editedSettings,
  isLoading,
  handleSettingChange,
  handleNumberInputChange,
  handleNumberInputBlur,
  sectionReset,
}) => {
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

  const common = { editedSettings, isLoading, handleSettingChange, sectionReset };
  const numberInput = { handleNumberInputChange, handleNumberInputBlur };

  return (
    <>
      <AdminSettingsWindowMain {...common} {...numberInput} />
      <AdminSettingsWindowWorkspace {...common} displays={displays} />
      <AdminSettingsWindowDetached {...common} />
      <AdminSettingsWindowOther {...common} {...numberInput} />
    </>
  );
};

export default AdminSettingsWindowSection;

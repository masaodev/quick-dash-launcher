import React from 'react';
import { useTranslation } from 'react-i18next';
import type { AppSettings } from '@common/types';

import { isSectionAtDefault, type ResettableSettingsSection } from '../utils/settingsResetKeys';

import { Button } from './ui';

/** 枠の「既定値に戻す」に要るもの（設定タブが持ち、各枠へ渡す） */
export interface SectionResetProps {
  /** 既定値（読み込むまでは null。その間は印を出さず、ボタンも押せない） */
  defaults: AppSettings | null;
  onReset: (section: ResettableSettingsSection) => void;
}

interface SettingsSectionHeaderProps extends SectionResetProps {
  title: string;
  section: ResettableSettingsSection;
  editedSettings: AppSettings;
  isLoading: boolean;
}

/**
 * 設定画面の枠の見出し。右端に「↺ 既定値に戻す」を置き、戻す範囲をその枠だけにする
 *
 * 既定値から変えている枠は見出しの後ろに ● を付ける。既定値のままの枠もボタンは消さずに押せなくする
 * （枠ごとに見出しの右が出たり消えたりしないように）。
 */
const SettingsSectionHeader: React.FC<SettingsSectionHeaderProps> = ({
  title,
  section,
  editedSettings,
  isLoading,
  defaults,
  onReset,
}) => {
  const { t } = useTranslation();
  const atDefault = defaults === null || isSectionAtDefault(section, editedSettings, defaults);

  return (
    <div className="settings-section-header">
      <h3>
        {title}
        {!atDefault && (
          <span
            className="settings-changed-dot"
            title={t('settings.reset.changed')}
            aria-label={t('settings.reset.changed')}
            data-testid={`settings-changed-${section}`}
          />
        )}
      </h3>
      {/* 押せないボタンはマウスの出入りを受けないので、ツールチップは包む側に付ける */}
      <span title={atDefault ? t('settings.reset.atDefault') : undefined}>
        <Button
          size="sm"
          className="settings-reset-button"
          onClick={() => onReset(section)}
          disabled={isLoading || atDefault}
          data-testid={`settings-reset-${section}`}
        >
          {t('settings.reset.button')}
        </Button>
      </span>
    </div>
  );
};

export default SettingsSectionHeader;

import React from 'react';

import {
  SETTINGS_RESET_LABELS,
  SETTINGS_RESET_NOTES,
  type ResettableSettingsCategory,
} from '../utils/settingsResetKeys';

import { Button } from './ui';

interface AdminSettingsResetSectionProps {
  category: ResettableSettingsCategory;
  isLoading: boolean;
  onReset: (category: ResettableSettingsCategory) => void;
}

/**
 * 設定カテゴリの末尾に置く「既定値に戻す」
 *
 * 戻す範囲はそのカテゴリの項目だけ。全設定を消す旧「リセット」の代わりで、
 * どこまで戻るかが画面上で分かる位置に置く。
 */
const AdminSettingsResetSection: React.FC<AdminSettingsResetSectionProps> = ({
  category,
  isLoading,
  onReset,
}) => {
  const label = SETTINGS_RESET_LABELS[category];
  const note = SETTINGS_RESET_NOTES[category];

  return (
    <div className="settings-section settings-reset-section">
      <div className="settings-reset-description">
        「{label}」の項目を既定値に戻します。{note ?? ''}
      </div>
      <Button
        variant="danger"
        size="sm"
        className="settings-reset-button"
        onClick={() => onReset(category)}
        disabled={isLoading}
      >
        {label}を既定値に戻す
      </Button>
    </div>
  );
};

export default AdminSettingsResetSection;

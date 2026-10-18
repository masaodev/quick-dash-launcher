import React from 'react';
import { useTranslation } from 'react-i18next';
import type { AppSettings } from '@common/types';

type WindowSizeKey = 'windowWidth' | 'windowHeight' | 'editModeWidth' | 'editModeHeight';

interface WindowSizeFieldsProps {
  widthKey: WindowSizeKey;
  heightKey: WindowSizeKey;
  widthRange: [number, number];
  heightRange: [number, number];
  editedSettings: AppSettings;
  isLoading: boolean;
  handleNumberInputChange: <K extends keyof AppSettings>(key: K, value: string) => void;
  handleNumberInputBlur: () => Promise<void>;
}

/** 設定画面「ウィンドウ」の大きさの欄（幅 [  ] px、高さ [  ] px） */
const WindowSizeFields: React.FC<WindowSizeFieldsProps> = ({
  widthKey,
  heightKey,
  widthRange,
  heightRange,
  editedSettings,
  isLoading,
  handleNumberInputChange,
  handleNumberInputBlur,
}) => {
  const { t } = useTranslation();
  const fields = [
    { key: widthKey, label: t('settings.windowSize.width'), range: widthRange },
    { key: heightKey, label: t('settings.windowSize.height'), range: heightRange },
  ];

  return (
    <div className="settings-form-line">
      {fields.map(({ key, label, range: [min, max] }) => (
        <span key={key} className="settings-form-field">
          <label htmlFor={key}>{label}</label>
          <input
            id={key}
            type="number"
            min={min}
            max={max}
            value={editedSettings[key]}
            onChange={(e) => handleNumberInputChange(key, e.target.value)}
            onBlur={handleNumberInputBlur}
            disabled={isLoading}
          />
          <span className="unit">px</span>
        </span>
      ))}
    </div>
  );
};

export default WindowSizeFields;

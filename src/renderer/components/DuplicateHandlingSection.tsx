import React from 'react';
import { useTranslation } from 'react-i18next';
import type { DuplicateHandlingOption } from '@common/types';

interface DuplicateHandlingSectionProps {
  /** 警告の文言（何件が重複しているか） */
  message: string;
  value: DuplicateHandlingOption;
  onChange: (value: DuplicateHandlingOption) => void;
  /** ラジオボタンの name（同じ画面の他のラジオボタンと分ける） */
  name: string;
}

const OPTIONS: DuplicateHandlingOption[] = ['skip', 'overwrite'];

/**
 * 取り込むアイテムが登録済みと重複しているときの警告と、扱い（スキップ／上書き）の選択欄
 * （ブックマークの自動取込ルール・アプリ取込で共通）
 */
const DuplicateHandlingSection: React.FC<DuplicateHandlingSectionProps> = ({
  message,
  value,
  onChange,
  name,
}) => {
  const { t } = useTranslation();

  return (
    <div className="duplicate-warning-section">
      <div className="duplicate-warning-message">
        <span className="duplicate-warning-icon">&#9888;</span>
        <span>{message}</span>
      </div>
      <div className="duplicate-options-section">
        <span className="duplicate-options-label">{t('importCommon.duplicateHandling')}</span>
        {OPTIONS.map((option) => (
          <label key={option} className="duplicate-option">
            <input
              type="radio"
              name={name}
              value={option}
              checked={value === option}
              onChange={() => onChange(option)}
            />
            <span>{t(`importCommon.${option}`)}</span>
          </label>
        ))}
      </div>
    </div>
  );
};

export default DuplicateHandlingSection;
